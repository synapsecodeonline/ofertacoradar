import { syncPrisma as prisma } from "./db";
import { discountPctOf } from "./format";
import { resolveCategory, resolveSubtype } from "./categories";
import {
  fetchLomadeeBrandsPage,
  fetchLomadeeCampaignsPage,
  fetchLomadeeProductsPage,
  normalizeLomadeeCampaign,
  type LomadeeBrand,
  type NormalizedProduct,
} from "./feed";
import {
  fetchMercadoLivrePage,
  ML_LIMIT,
  ML_QUERIES,
} from "./mercadolivre";
import {
  CHECKABLE_PREFIXES,
  mapLimit,
  validateProductLink,
} from "./linkcheck";

// Sync incremental disparado pelo trafego: cada pageview processa um pedaco
// do ciclo em background (apos a resposta), sem atrasar o usuario.
// Ciclo Lomadee: brands -> campaigns (ofertas camp:) -> products (prod:) -> espera TTL -> recomeca.

// Fontes de afiliado (ver externalId em Product):
//   camp: = oferta/cupom Lomadee | prod: = produto Lomadee
//   ml:   = produto Mercado Livre | aw:  = produto Awin
const STATE_KEY = "main";
const BUDGET_MS = 45_000; // tempo maximo de trabalho por invocacao
const CYCLE_TTL_MS = 60_000; // novo ciclo completo a cada 1 minuto
const LOCK_STALE_MS = 3 * 60_000; // trava expira se o worker morrer

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertByExternalId(
  p: NormalizedProduct,
  merchantFallback?: string,
  segment?: string | null,
) {
  const merchant = p.merchant ?? merchantFallback ?? null;
  const category = resolveCategory(p.category, p.title, merchant, segment);
  const data = {
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    oldPrice: p.oldPrice,
    discountPct: discountPctOf(p),
    category,
    subtype: resolveSubtype(category, p.title),
    merchant,
    organizationId: p.organizationId ?? null,
    url: p.url,
    // prod-lomadee sem affiliateUrl do feed: preserva flag "link direto"
    // marcada pelo validador (loja que quebra com lmdeeTracking)
    affiliateUrl:
      p.affiliateUrl ??
      (p.externalId?.startsWith("prod-lomadee:") ? undefined : null),
    couponCode: p.couponCode,
    endsAt: p.endsAt,
    active: true,
  };
  if (!p.externalId) return;
  // active nao vai no update cego: produto desativado pelo validador de
  // links (link morto) nao pode voltar so porque o feed ainda lista.
  // So reativa quando a URL muda de verdade (link novo = merece recheck).
  const { active: _active, ...rest } = data;
  // updatedAt explicito: a reconciliacao com o feed depende dele
  const touch = { ...rest, updatedAt: new Date() };
  const urlChanged = await prisma.product.updateMany({
    where: { externalId: p.externalId, url: { not: p.url } },
    data: { ...touch, active: true },
  });
  if (urlChanged.count === 0) {
    const sameUrl = await prisma.product.updateMany({
      where: { externalId: p.externalId, url: p.url },
      data: touch,
    });
    if (sameUrl.count === 0) {
      await prisma.product.create({
        data: { ...data, externalId: p.externalId },
      });
    }
  }
}

// Inicio do ciclo atual (marcado na fase brands). A reconciliacao usa
// updatedAt dos produtos: quem o feed ainda retorna recebe timestamp
// novo a cada ciclo; quem sumiu fica velho e e desativado.
const META_KEY = "meta";

async function reconcileLomadeeFeed() {
  const meta = await prisma.syncState.findUnique({ where: { key: META_KEY } });
  const since = meta?.lastCycleAt;
  if (!since) return;
  const d = await prisma.product.updateMany({
    where: {
      active: true,
      updatedAt: { lt: since },
      OR: [
        { externalId: { startsWith: "prod-lomadee:" } },
        { externalId: { startsWith: "camp-lomadee:" } },
      ],
    },
    data: { active: false },
  });
  if (d.count > 0) {
    console.log(`[syncer] ${d.count} itens Lomadee ausentes do feed desativados`);
  }
}

async function runCycle(apiKey: string, baseUrl: string) {
  const state = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!state) return;

  let { phase, page } = state;
  if (phase === "done") {
    await prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: "brands", page: 1, orgsCleared: false },
    });
    // marca o inicio do ciclo para a reconciliacao do feed
    await prisma.syncState.upsert({
      where: { key: META_KEY },
      create: { key: META_KEY, lastCycleAt: new Date() },
      update: { lastCycleAt: new Date() },
    });
    phase = "brands";
    page = 1;
  }

  const deadline = Date.now() + BUDGET_MS;
  const timeLeft = () => Date.now() < deadline;
  const save = () =>
    prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase, page },
    });

  // Fase links: validacao rotativa de URLs de parceiros. Roda DEPOIS do
  // catalogo ser atualizado — produto morto pelo feed nao volta porque o
  // upsert preserva active=false quando a URL nao muda.
  // Cursor = page (ultimo id verificado). ml: nunca e checado (anti-bot).
  if (phase === "links") {
    while (timeLeft()) {
      const batch = await prisma.product.findMany({
        where: {
          active: true,
          id: { gt: page },
          OR: CHECKABLE_PREFIXES.map((pre) => ({
            externalId: { startsWith: pre },
          })),
        },
        orderBy: { id: "asc" },
        take: 40,
        select: {
          id: true,
          title: true,
          url: true,
          affiliateUrl: true,
          externalId: true,
        },
      });
      if (batch.length === 0) {
        phase = "done";
        page = 1;
        break;
      }
      const results = await mapLimit(batch, 6, (p) => validateProductLink(p));
      let dead = 0;
      let direct = 0;
      for (let i = 0; i < batch.length; i++) {
        const p = batch[i];
        const st = results[i];
        if (st === "dead") {
          await prisma.product
            .update({ where: { id: p.id }, data: { active: false } })
            .then(() => dead++)
            .catch(() => {});
        } else if (st === "direct") {
          // loja quebra com lmdeeTracking: /ir/ vai direto na url
          await prisma.product
            .update({ where: { id: p.id }, data: { affiliateUrl: p.url } })
            .then(() => direct++)
            .catch(() => {});
        } else if (st === "ok" && p.affiliateUrl === p.url) {
          // loja voltou a aguentar o param: volta pro lmdee.link (comissao)
          await prisma.product
            .update({ where: { id: p.id }, data: { affiliateUrl: null } })
            .catch(() => {});
        }
      }
      page = batch[batch.length - 1].id;
      await save();
      if (dead > 0 || direct > 0) {
        console.log(`[syncer] links: ${dead} mortos, ${direct} p/ link direto`);
      }
    }
    if (phase === "done") {
      await prisma.syncState.update({
        where: { key: STATE_KEY },
        data: { phase: "done", page: 1, lastCycleAt: new Date() },
      });
    }
    return;
  }

  // Fase 1: marcas (base p/ nome/logo das ofertas)
  const brands = new Map<string, LomadeeBrand>();
  while (phase === "brands" && timeLeft()) {
    const { items, totalPages } = await fetchLomadeeBrandsPage(
      apiKey,
      baseUrl,
      page,
    );
    for (const b of items) {
      brands.set(b.id, b);
      await prisma.brand
        .upsert({
          where: { id: b.id },
          create: { id: b.id, name: b.name, logo: b.logo, site: b.site, segment: b.segment },
          update: { name: b.name, logo: b.logo, site: b.site, segment: b.segment },
        })
        .catch(() => {});
    }
    if (page >= totalPages) {
      await prisma.affiliatedOrg.deleteMany();
      phase = "campaigns";
      page = 1;
    } else {
      page++;
    }
    await save();
    await sleep(300);
  }
  if (phase === "brands") return;

  if (brands.size === 0) {
    const rows = await prisma.brand.findMany();
    for (const b of rows) {
      brands.set(b.id, {
        id: b.id,
        name: b.name,
        logo: b.logo ?? undefined,
        site: b.site ?? undefined,
        segment: (b as { segment?: string | null }).segment ?? undefined,
      });
    }
  }

  // Fase 2: campanhas -> ofertas/cupons com link lmdee.link
  let consecutiveFailures = 0;
  while (phase === "campaigns" && timeLeft()) {
    let result: { items: import("./feed").LomadeeCampaign[]; totalPages: number };
    try {
      result = await fetchLomadeeCampaignsPage(apiKey, baseUrl, page);
    } catch {
      page++;
      if (++consecutiveFailures > 30) {
        phase = "products";
        page = 1;
      }
      await save();
      continue;
    }
    consecutiveFailures = 0;

    for (const c of result.items) {
      const brand = c.organizationId ? brands.get(c.organizationId) : undefined;
      const n = normalizeLomadeeCampaign(c, brand);
      if (!n || !n.product.imageUrl) continue;
      await upsertByExternalId(
        n.product,
        n.org?.organizationId ? brands.get(n.org.organizationId)?.name : undefined,
        brand?.segment,
      ).catch(() => {});
      if (n.org) {
        await prisma.affiliatedOrg
          .upsert({
            where: { organizationId: n.org.organizationId },
            create: {
              organizationId: n.org.organizationId,
              name: n.org.name,
            },
            update: { name: n.org.name },
          })
          .catch(() => {});
      }
    }

    if (page >= result.totalPages) {
      phase = "products";
      page = 1;
    } else {
      page++;
    }
    await save();
    await sleep(300);
  }
  if (phase === "campaigns") return;

  // Fase 3: catalogo Lomadee -> so produtos prod: de orgs afiliadas e preco > 0
  const orgIds = new Set(
    (await prisma.affiliatedOrg.findMany({ select: { organizationId: true } }))
      .map((o) => o.organizationId),
  );
  // Nome da org afiliada vira merchant quando o catalogo nao informa
  const orgNames = new Map(
    (
      await prisma.affiliatedOrg.findMany({
        select: { organizationId: true, name: true },
      })
    )
      .filter((o) => o.name)
      .map((o) => [o.organizationId, o.name!]),
  );
  if (orgIds.size === 0) {
    phase = "done";
    await reconcileLomadeeFeed();
    await prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: "done", page: 1, lastCycleAt: new Date() },
    });
    return;
  }

  while (phase === "products" && timeLeft()) {
    const { items } = await fetchLomadeeProductsPage(apiKey, baseUrl, page, 100);
    for (const p of items) {
      if (
        !p.organizationId ||
        !orgIds.has(p.organizationId) ||
        p.price === 0 ||
        !p.imageUrl
      ) {
        continue;
      }
      await upsertByExternalId(
        {
          ...p,
          externalId: `prod-lomadee:${p.externalId}`,
          affiliateUrl: undefined,
        },
        p.organizationId ? orgNames.get(p.organizationId) : undefined,
        p.organizationId ? brands.get(p.organizationId)?.segment : undefined,
      ).catch(() => {});
    }
    if (items.length < 100) {
      // catalogo varrido: o que nao foi visto neste ciclo saiu do feed
      await reconcileLomadeeFeed();
      phase = "links";
      page = 0; // cursor do validador comeca do id 0
    } else {
      page++;
    }
    await save();
    await sleep(300);
  }

  if (phase === "done") {
    await prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: "done", page: 1, lastCycleAt: new Date() },
    });
  }
}

// ---- Sync Mercado Livre (independente da Lomadee) ----
// Chave propria no SyncState ("ml"): nao depende de LOMADEE_API_KEY e nao
// interfere no ciclo Lomadee. Fases: q:{indice da query} com page=offset.

const ML_STATE_KEY = "ml";
const ML_MAX_OFFSET = 200; // ate 4 paginas de ML_LIMIT por query

async function runMLCycle() {
  const state = await prisma.syncState.findUnique({
    where: { key: ML_STATE_KEY },
  });
  if (!state) return;

  let qi = 0;
  let page = 1;
  if (state.phase.startsWith("q:")) {
    qi = Number(state.phase.slice(2)) || 0;
    page = state.page;
  } else if (state.phase !== "done") {
    qi = 0;
    page = 1;
  }

  const deadline = Date.now() + BUDGET_MS;
  const save = () =>
    prisma.syncState.update({
      where: { key: ML_STATE_KEY },
      data: { phase: `q:${qi}`, page },
    });

  let consecutiveFailures = 0;
  while (qi < ML_QUERIES.length && Date.now() < deadline) {
    let result: Awaited<ReturnType<typeof fetchMercadoLivrePage>>;
    try {
      result = await fetchMercadoLivrePage(ML_QUERIES[qi], (page - 1) * ML_LIMIT);
    } catch {
      // pula a query em vez de abortar o ciclo
      qi++;
      page = 1;
      if (++consecutiveFailures > 10) break;
      await save();
      await sleep(400);
      continue;
    }
    consecutiveFailures = 0;

    if (!result) {
      // sem token configurado: encerra o ciclo e tenta de novo no proximo TTL
      await prisma.syncState.update({
        where: { key: ML_STATE_KEY },
        data: { phase: "done", page: 1, lastCycleAt: new Date() },
      });
      return;
    }

    for (const p of result.items) {
      if (!p.imageUrl) continue;
      await upsertByExternalId(p, "Mercado Livre").catch(() => {});
    }

    if ((page - 1) * ML_LIMIT + ML_LIMIT >= ML_MAX_OFFSET ||
        (page - 1) * ML_LIMIT + ML_LIMIT >= result.total) {
      qi++;
      page = 1;
    } else {
      page++;
    }
    await save();
    await sleep(400);
  }

  if (qi >= ML_QUERIES.length) {
    await prisma.syncState.update({
      where: { key: ML_STATE_KEY },
      data: { phase: "done", page: 1, lastCycleAt: new Date() },
    });
  }
}

// Chamado via after() junto do maybeSyncLomadee: nunca bloqueia a resposta
export async function maybeSyncML(force = false) {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return;

  await prisma.syncState.upsert({
    where: { key: ML_STATE_KEY },
    create: { key: ML_STATE_KEY, phase: "q:0", page: 1 },
    update: {},
  });
  const state = await prisma.syncState.findUnique({
    where: { key: ML_STATE_KEY },
  });
  if (!state) return;

  const now = Date.now();
  const lockFresh =
    state.busyAt && now - state.busyAt.getTime() < LOCK_STALE_MS;
  const cycleFresh =
    !force &&
    state.phase === "done" &&
    state.lastCycleAt &&
    now - state.lastCycleAt.getTime() < CYCLE_TTL_MS;
  if (lockFresh || cycleFresh) return;

  const locked = await prisma.syncState.updateMany({
    where: {
      key: ML_STATE_KEY,
      OR: [
        { busyAt: null },
        { busyAt: { lt: new Date(now - LOCK_STALE_MS) } },
      ],
    },
    data: { busyAt: new Date(now) },
  });
  if (locked.count === 0) return;

  try {
    await runMLCycle();
  } catch (e) {
    console.error("[syncer:ml] ciclo falhou:", e);
  } finally {
    await prisma.syncState
      .update({ where: { key: ML_STATE_KEY }, data: { busyAt: null } })
      .catch(() => {});
  }
}

// Chamado via after() nas paginas: nunca bloqueia a resposta
export async function maybeSyncLomadee(force = false) {
  const apiKey = process.env.LOMADEE_API_KEY;
  if (!apiKey) return;
  const baseUrl = process.env.LOMADEE_API_URL ?? "https://api.lomadee.com.br";

  await prisma.syncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY },
    update: {},
  });
  const state = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!state) return;

  const now = Date.now();
  const lockFresh =
    state.busyAt && now - state.busyAt.getTime() < LOCK_STALE_MS;
  const cycleFresh =
    !force &&
    state.phase === "done" &&
    state.lastCycleAt &&
    now - state.lastCycleAt.getTime() < CYCLE_TTL_MS;
  if (lockFresh || cycleFresh) return;

  const locked = await prisma.syncState.updateMany({
    where: {
      key: STATE_KEY,
      OR: [
        { busyAt: null },
        { busyAt: { lt: new Date(now - LOCK_STALE_MS) } },
      ],
    },
    data: { busyAt: new Date(now) },
  });
  if (locked.count === 0) return;

  try {
    await runCycle(apiKey, baseUrl);
  } catch (e) {
    console.error("[syncer] ciclo falhou:", e);
  } finally {
    await prisma.syncState
      .update({ where: { key: STATE_KEY }, data: { busyAt: null } })
      .catch(() => {});
  }
}

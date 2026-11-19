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

// Bloqueio manual de lojistas: produto dessas URLs nem entra no banco.
// Rovitex: catalogo desatualizado na Lomadee, links quebram no site
// deles — bloqueado ate o usuario dar o sinal.
const BLOCKED_URL_PARTS = ["rovitex.com.br"];
const BLOCKED_MERCHANTS = ["rovitex"];

async function upsertByExternalId(
  p: NormalizedProduct,
  merchantFallback?: string,
  segment?: string | null,
) {
  const merchant = p.merchant ?? merchantFallback ?? null;
  if (
    BLOCKED_URL_PARTS.some(
      (b) => p.url.includes(b) || (p.affiliateUrl ?? "").includes(b),
    ) ||
    (merchant ?? "").toLowerCase().includes(BLOCKED_MERCHANTS[0])
  ) {
    return;
  }
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
    affiliateUrl: p.affiliateUrl ?? null,
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
      // busyAt como heartbeat: mantem a trava fresca enquanto ha
      // progresso — sem isso ciclos longos (>3min) pareciam "travados"
      // e a trava expirava permitindo syncs duplicados.
      data: { phase, page, busyAt: new Date() },
    });

  // Fase links: validacao rotativa de URLs de parceiros. Roda DEPOIS do
  // catalogo ser atualizado — produto morto pelo feed nao volta porque o
  // upsert preserva active=false quando a URL nao muda.
  // Cursor = page (ultimo id verificado). ml: validado via API oficial.
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
          organizationId: true,
          imageUrl: true,
        },
      });
      if (batch.length === 0) {
        phase = "done";
        page = 1;
        break;
      }
      const results = await mapLimit(batch, 6, (p) => validateProductLink(p));
      let dead = 0;
      for (let i = 0; i < batch.length; i++) {
        if (results[i] === "dead") {
          await prisma.product
            .update({ where: { id: batch[i].id }, data: { active: false } })
            .then(() => dead++)
            .catch(() => {});
        }
      }
      page = batch[batch.length - 1].id;
      await save();
      if (dead > 0) {
        console.log(`[syncer] links: ${dead}/${batch.length} com link morto desativados`);
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
      // heartbeat da trava (ver runCycle)
      data: { phase: `q:${qi}`, page, busyAt: new Date() },
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
      if (++consecutiveFailures > 10) {
        await noteError(ML_STATE_KEY, "API do Mercado Livre sem resposta");
        break;
      }
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

// ---- Trava + heartbeat compartilhados ----

async function acquireLock(key: string): Promise<boolean> {
  const locked = await prisma.syncState.updateMany({
    where: {
      key,
      OR: [
        { busyAt: null },
        { busyAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } },
      ],
    },
    data: { busyAt: new Date() },
  });
  return locked.count > 0;
}

function busyFresh(busyAt: Date | null): boolean {
  return !!busyAt && Date.now() - busyAt.getTime() < LOCK_STALE_MS;
}

// Sinal de vida fora da trava: busyAt vira null entre blocos de 45s,
// entao guardamos a ultima atividade em linhas auxiliares do SyncState
// (sem migracao de schema): `${key}:beat` e `${key}:err`.
const beatKey = (k: string) => `${k}:beat`;
const errKey = (k: string) => `${k}:err`;

async function beat(key: string) {
  const bk = beatKey(key);
  await prisma.syncState
    .upsert({
      where: { key: bk },
      create: { key: bk, busyAt: new Date() },
      update: { busyAt: new Date() },
    })
    .catch(() => {});
}

async function noteError(key: string, msg: string) {
  const ek = errKey(key);
  await prisma.syncState
    .upsert({
      where: { key: ek },
      create: { key: ek, phase: msg.slice(0, 200), busyAt: new Date() },
      update: { phase: msg.slice(0, 200), busyAt: new Date() },
    })
    .catch(() => {});
}

async function clearError(key: string) {
  await prisma.syncState
    .delete({ where: { key: errKey(key) } })
    .catch(() => {});
}

// Heartbeat: mantem busyAt fresco a cada 30s durante TODO o ciclo.
// Sem isso, fases longas sem checkpoint deixam busyAt velho -> alerta
// "travado" falso e trava expira permitindo sync duplicado.
function startHeartbeat(key: string) {
  const hb = setInterval(() => {
    prisma.syncState
      .update({ where: { key }, data: { busyAt: new Date() } })
      .catch(() => {});
    beat(key);
  }, 30_000);
  hb.unref?.();
  return hb;
}

async function releaseLock(key: string, hb: ReturnType<typeof setInterval>) {
  clearInterval(hb);
  await prisma.syncState
    .update({ where: { key }, data: { busyAt: null } })
    .catch(() => {});
  // registra o fim do bloco como atividade — o proximo cron retoma
  await beat(key);
}

async function runMLLocked() {
  const hb = startHeartbeat(ML_STATE_KEY);
  try {
    await runMLCycle();
    await clearError(ML_STATE_KEY);
  } catch (e) {
    console.error("[syncer:ml] ciclo falhou:", e);
    await noteError(ML_STATE_KEY, e instanceof Error ? e.message : String(e));
  } finally {
    await releaseLock(ML_STATE_KEY, hb);
  }
}

async function runLomadeeLocked(apiKey: string, baseUrl: string) {
  const hb = startHeartbeat(STATE_KEY);
  try {
    await runCycle(apiKey, baseUrl);
    await clearError(STATE_KEY);
  } catch (e) {
    console.error("[syncer] ciclo falhou:", e);
    await noteError(STATE_KEY, e instanceof Error ? e.message : String(e));
  } finally {
    await releaseLock(STATE_KEY, hb);
  }
}

// ---- Sync manual de todas as fontes (botao do /admin) ----

export type SyncSourceStatus = "started" | "busy" | "skipped";

export interface ForcedSyncResult {
  results: { source: "lomadee" | "ml" | "awin"; status: SyncSourceStatus }[];
  // roda as fontes adquiridas — chamar dentro de after()
  run: () => Promise<void>;
}

// Adquire a trava de cada fonte disponível e devolve o status na hora.
// O trabalho pesado fica para run() (executar via after() na rota).
export async function startAllSyncs(): Promise<ForcedSyncResult> {
  const results: ForcedSyncResult["results"] = [];
  const tasks: (() => Promise<void>)[] = [];

  const apiKey = process.env.LOMADEE_API_KEY;
  const baseUrl = process.env.LOMADEE_API_URL ?? "https://api.lomadee.com.br";
  if (!apiKey) {
    results.push({ source: "lomadee", status: "skipped" });
  } else {
    await prisma.syncState.upsert({
      where: { key: STATE_KEY },
      create: { key: STATE_KEY },
      update: {},
    });
    const st = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
    if (busyFresh(st?.busyAt ?? null) || !(await acquireLock(STATE_KEY))) {
      results.push({ source: "lomadee", status: "busy" });
    } else {
      results.push({ source: "lomadee", status: "started" });
      tasks.push(() => runLomadeeLocked(apiKey, baseUrl));
    }
  }

  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) {
    results.push({ source: "ml", status: "skipped" });
  } else {
    await prisma.syncState.upsert({
      where: { key: ML_STATE_KEY },
      create: { key: ML_STATE_KEY, phase: "q:0", page: 1 },
      update: {},
    });
    const st = await prisma.syncState.findUnique({ where: { key: ML_STATE_KEY } });
    if (busyFresh(st?.busyAt ?? null) || !(await acquireLock(ML_STATE_KEY))) {
      results.push({ source: "ml", status: "busy" });
    } else {
      results.push({ source: "ml", status: "started" });
      tasks.push(() => runMLLocked());
    }
  }

  // Awin ainda nao tem sincronizador implementado
  results.push({ source: "awin", status: "skipped" });

  return {
    results,
    run: async () => {
      await Promise.all(tasks.map((t) => t()));
    },
  };
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
  if (!(await acquireLock(ML_STATE_KEY))) return;

  await runMLLocked();
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
  if (!(await acquireLock(STATE_KEY))) return;

  await runLomadeeLocked(apiKey, baseUrl);
}

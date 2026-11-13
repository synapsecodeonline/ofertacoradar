import { prisma } from "./db";
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

// Sync incremental disparado pelo trafego: cada pageview processa um pedaco
// do ciclo em background (apos a resposta), sem atrasar o usuario.
// Ciclo: brands -> campaigns (ofertas) -> products -> espera TTL -> recomeca.

const STATE_KEY = "main";
const BUDGET_MS = 45_000; // tempo maximo de trabalho por invocacao
const CYCLE_TTL_MS = 30 * 60_000; // intervalo entre ciclos completos
const LOCK_STALE_MS = 3 * 60_000; // trava expira se o worker morrer

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertByExternalId(
  p: NormalizedProduct,
  merchantFallback?: string,
) {
  const merchant = p.merchant ?? merchantFallback ?? null;
  const category = resolveCategory(p.category, p.title, merchant);
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
  await prisma.product.upsert({
    where: { externalId: p.externalId },
    create: { ...data, externalId: p.externalId },
    update: data,
  });
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
          create: { id: b.id, name: b.name, logo: b.logo, site: b.site },
          update: { name: b.name, logo: b.logo, site: b.site },
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

  // Fase 3: catalogo -> so produtos de orgs afiliadas e preco > 0
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
          externalId: `prod:${p.externalId}`,
          affiliateUrl: undefined,
        },
        p.organizationId ? orgNames.get(p.organizationId) : undefined,
      ).catch(() => {});
    }
    if (items.length < 100) {
      phase = "done";
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

// Chamado via after() nas paginas: nunca bloqueia a resposta
export async function maybeSync() {
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

import { prisma } from "./db";

// Relatorios de comissao das fontes de afiliado.
// Lomadee: API publica de pedidos (/affiliate/orders) — comissao real.
// Mercado Livre: NAO existe API publica de ganhos de afiliado — o painel
// de metricas so existe logado no site; nao da pra automatizar de forma
// legitima. Awin: idem ate existir conta/feed.

const CACHE_MS = 60 * 60_000; // 1h
const MAX_PAGES = 10; // ate 1000 pedidos por consulta

export interface SourceRevenue {
  source: "lomadee" | "mercadolivre" | "awin";
  available: boolean;
  reason?: string;
  orders?: number;
  sales?: number;
  commission?: number;
  commissionApproved?: number;
  commissionPending?: number;
  byDay?: { date: string; orders: number; commission: number }[];
}

interface LomadeeOrder {
  status?: string;
  commissionStatus?: string;
  value?: number;
  commission?: number;
  createdAt?: string;
}

const cache = new Map<string, { at: number; value: SourceRevenue }>();

async function cached(key: string, fn: () => Promise<SourceRevenue>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchLomadeeRevenue(days: number): Promise<SourceRevenue> {
  const apiKey = process.env.LOMADEE_API_KEY;
  if (!apiKey) {
    return {
      source: "lomadee",
      available: false,
      reason: "LOMADEE_API_KEY nao configurada",
    };
  }
  const baseUrl =
    process.env.LOMADEE_API_URL ?? "https://api.lomadee.com.br";

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  let orders = 0;
  let sales = 0;
  let commission = 0;
  let commissionApproved = 0;
  let commissionPending = 0;
  const byDay = new Map<string, { orders: number; commission: number }>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${baseUrl}/affiliate/orders?page=${page}&limit=100` +
      `&from=${iso(from)}&to=${iso(to)}`;
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        source: "lomadee",
        available: false,
        reason: `API de pedidos retornou HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      data?: unknown[];
      meta?: { totalPages?: number };
    };
    const items = Array.isArray(json.data) ? json.data : [];

    for (const entry of items) {
      // O schema da API envolve o pedido em entry.data; tolera os dois formatos
      const raw = (entry as { data?: LomadeeOrder }).data ?? (entry as LomadeeOrder);
      const o = raw as LomadeeOrder;
      const value = Number(o.value ?? 0);
      const comm = Number(o.commission ?? 0);
      const rejected =
        o.status === "rejected" || o.commissionStatus === "rejected";
      orders++;
      sales += value;
      commission += comm;
      if (!rejected) {
        if (o.commissionStatus === "approved") commissionApproved += comm;
        else commissionPending += comm;
      }
      const day = (o.createdAt ?? "").slice(0, 10);
      if (day) {
        const cur = byDay.get(day) ?? { orders: 0, commission: 0 };
        cur.orders++;
        cur.commission += comm;
        byDay.set(day, cur);
      }
    }

    const totalPages = json.meta?.totalPages ?? 1;
    if (page >= totalPages || items.length === 0) break;
  }

  // So pedidos com comissao > 0 entram no grafico diario
  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return {
    source: "lomadee",
    available: true,
    orders,
    sales,
    commission,
    commissionApproved,
    commissionPending,
    byDay: daily,
  };
}

export async function getRevenueReport(
  days = 30,
): Promise<SourceRevenue[]> {
  const lomadee = await cached(`lomadee:${days}`, () =>
    fetchLomadeeRevenue(days).catch((e) => ({
      source: "lomadee" as const,
      available: false,
      reason: `Falha ao consultar API: ${e instanceof Error ? e.message : e}`,
    })),
  );

  return [
    lomadee,
    {
      source: "mercadolivre",
      available: false,
      reason:
        "Mercado Livre nao expoe API publica de ganhos de afiliado",
    },
    {
      source: "awin",
      available: false,
      reason: "Awin ainda nao tem conta/feed configurado",
    },
  ];
}

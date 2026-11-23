// Sincronizador Awin — product datafeeds por anunciante.
//
// A Awin nao tem API publica de catalogo: cada anunciante aprovado
// disponibiliza um feed de produtos (CSV, as vezes XML/JSON) na
// plataforma. Este modulo baixa os feeds configurados e grava como
// aw:{anunciante}:{produto} — mesmo upsert das outras fontes.
//
// Configuracao (.env):
//   AWIN_FEEDS  — JSON array ou URLs separadas por ";"/newline:
//     [
//       { "url": "https://productdata.awin.com/.../feed.csv",
//         "advertiser": "Nome da Loja",   // fallback se o feed nao trouxer
//         "awinmid": "12345" },           // id do anunciante (deep link)
//       "https://outro-feed.csv"
//     ]
//   AWIN_AFFID  — seu publisher/affiliate ID da Awin. Usado para montar
//     o deep link awin1.com/cread.php quando o feed NAO traz link
//     rastreado pronto. Se o feed ja trouxer aw_deep_link/click_url,
//     ele e usado direto (melhor cenario).
//
// Deep link: feed traz aw_deep_link -> usa direto. Senao monta
//   https://www.awin1.com/cread.php?awinmid={mid}&awinaffid={affid}&ued={url}
// Sem awinmid/affid e sem link no feed, o produto entra com url direta
// (SEM comissao) — configure os dois para garantir rastreio.

import { syncPrisma as prisma } from "./db";
import { upsertByExternalId } from "./upsert";
import { purgeProducts } from "./product-purge";
import type { NormalizedProduct } from "./feed";
import { XMLParser } from "fast-xml-parser";
import {
  LOCK_STALE_MS,
  acquireLock,
  busyFresh,
  clearError,
  errorBackoffActive,
  noteError,
  releaseLock,
  startHeartbeat,
} from "./sync-lock";

const STATE_KEY = "awin";
const META_KEY = "awin:meta"; // lastCycleAt = inicio do ciclo (reconciliacao)
const BUDGET_MS = 45_000;
const CYCLE_TTL_MS = 60_000;

export interface AwinFeedCfg {
  url: string;
  advertiser?: string;
  awinmid?: string;
}

function toCfg(v: unknown): AwinFeedCfg | null {
  if (typeof v === "string") {
    const url = v.trim();
    return url ? { url } : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) return null;
    return {
      url,
      advertiser: typeof o.advertiser === "string" ? o.advertiser : undefined,
      awinmid: typeof o.awinmid === "string" ? o.awinmid : undefined,
    };
  }
  return null;
}

export function awinFeeds(): AwinFeedCfg[] {
  const raw = process.env.AWIN_FEEDS?.trim();
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      return j.map(toCfg).filter((c): c is AwinFeedCfg => c !== null);
    }
  } catch {
    // nao e JSON — tenta lista separada por ; ou newline
  }
  return raw
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}

// ---------- parsing tolerante: CSV / JSON / XML -> linhas planas ----------

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") + 1 || clean.length);
  const delim = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Row = {};
    head.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
}

function scalar(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["#text", "__text", "value", "url", "href"]) {
      if (o[k] != null) return scalar(o[k]);
    }
    return "";
  }
  return String(v).trim();
}

function flatRow(v: unknown): Row {
  const o: Row = {};
  if (!v || typeof v !== "object") return o;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.replace(/^@_/, "").toLowerCase();
    const s = scalar(val);
    if (s) o[key] = s;
  }
  return o;
}

function findArray(v: unknown, depth = 0): unknown[] | null {
  if (depth > 4 || v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v !== "object") return null;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      return val;
    }
  }
  for (const val of Object.values(v as Record<string, unknown>)) {
    const found = findArray(val, depth + 1);
    if (found) return found;
  }
  return null;
}

async function fetchRows(cfg: AwinFeedCfg): Promise<Row[]> {
  const res = await fetch(cfg.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`feed ${res.status} ${res.statusText}`.slice(0, 160));
  }
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
    }).parse(text);
    const items = findArray(parsed) ?? [];
    return items.map(flatRow);
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    const items = findArray(parsed) ?? [];
    return items.map(flatRow);
  }
  return parseCsv(text);
}

// ---------- normalizacao ----------

function pick(row: Row, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v) return v;
  }
  return "";
}

function toNum(v: string): number | undefined {
  if (!v) return undefined;
  let s = v.replace(/[^\d.,-]/g, "").trim();
  if (!s) return undefined;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function toDate(v: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function normalizeAwinRow(
  row: Row,
  cfg: AwinFeedCfg,
): NormalizedProduct | null {
  const title = pick(row, ["product_name", "name", "title", "productname"]);
  if (!title) return null;

  let url = pick(row, [
    "product_url",
    "url",
    "link",
    "landing_page",
    "destination_url",
  ]);
  const click = pick(row, [
    "aw_deep_link",
    "deep_link",
    "click_url",
    "tracking_url",
    "affiliate_url",
    "aw_click_url",
  ]);

  // Deep link pronto no feed -> usa direto. Senao monta o cread.php
  // da Awin com o advertiser id do feed + nosso publisher id.
  let affiliateUrl = click || undefined;
  if (!affiliateUrl && url && cfg.awinmid && process.env.AWIN_AFFID) {
    affiliateUrl = `https://www.awin1.com/cread.php?awinmid=${cfg.awinmid}&awinaffid=${process.env.AWIN_AFFID}&ued=${encodeURIComponent(url)}`;
  }
  // Sem url direta mas com deep link: tenta recuperar o destino do ued=
  if (!url && affiliateUrl) {
    const m = affiliateUrl.match(/[?&]ued=([^&]+)/);
    if (m) url = decodeURIComponent(m[1]);
  }
  if (!url) return null;

  const merchant =
    pick(row, [
      "advertiser_name",
      "merchant_name",
      "advertiser",
      "merchant",
      "brand_name",
      "brand",
    ]) || cfg.advertiser;

  const imageUrl = pick(row, [
    "aw_image_url",
    "image_url",
    "product_image_url",
    "image",
    "thumbnail",
    "picture",
  ]);
  if (!imageUrl) return null;

  const pid =
    pick(row, [
      "aw_product_id",
      "product_id",
      "id",
      "merchant_product_id",
      "sku",
      "productid",
    ]) || hash(url);
  const advKey =
    cfg.awinmid ?? slug(merchant ?? "awin") ?? slug(new URL(url).hostname);

  return {
    externalId: `aw:${advKey}:${pid}`,
    title,
    description: pick(row, [
      "product_description",
      "description",
      "desc",
      "short_description",
    ]),
    imageUrl,
    price: toNum(pick(row, ["product_price", "price", "sale_price", "current_price", "preco"])),
    oldPrice: toNum(
      pick(row, ["product_rrp", "rrp", "list_price", "was_price", "original_price", "preco_antigo"]),
    ),
    category: pick(row, ["category_name", "category", "product_category", "department", "categoria"]),
    merchant,
    url,
    affiliateUrl,
    couponCode: pick(row, ["coupon_code", "voucher_code", "promo_code", "cupom"]) || undefined,
    endsAt: toDate(pick(row, ["expiry_date", "end_date", "valid_until", "valid_to"])),
  };
}

// ---------- ciclo de sync ----------

async function reconcileAwin(cycleStart: Date) {
  const d = await purgeProducts({
    active: true,
    updatedAt: { lt: cycleStart },
    externalId: { startsWith: "aw:" },
  });
  if (d > 0) {
    console.log(`[awin] ${d} itens ausentes dos feeds removidos`);
  }
}

async function runAwCycle() {
  const feeds = awinFeeds();
  const state = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!state || feeds.length === 0) return;

  let fi = 0;
  let rowIdx = 0;
  if (state.phase.startsWith("f:")) {
    fi = Number(state.phase.slice(2)) || 0;
    rowIdx = state.page;
  } else if (state.phase !== "done") {
    fi = 0;
    rowIdx = 0;
  }

  // Inicio de ciclo novo: marca o timestamp p/ reconciliacao
  if (state.phase === "done") {
    await prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: "f:0", page: 0, busyAt: new Date() },
    });
    await prisma.syncState.upsert({
      where: { key: META_KEY },
      create: { key: META_KEY, lastCycleAt: new Date() },
      update: { lastCycleAt: new Date() },
    });
    fi = 0;
    rowIdx = 0;
  }

  const deadline = Date.now() + BUDGET_MS;
  const save = () =>
    prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: `f:${fi}`, page: rowIdx, busyAt: new Date() },
    });

  while (fi < feeds.length && Date.now() < deadline) {
    const cfg = feeds[fi];
    let rows: Row[];
    try {
      rows = await fetchRows(cfg);
    } catch (e) {
      await noteError(
        STATE_KEY,
        `feed ${fi + 1}/${feeds.length} falhou: ${e instanceof Error ? e.message : e}`,
      );
      fi++;
      rowIdx = 0;
      await save();
      continue;
    }

    let i = rowIdx;
    while (i < rows.length && Date.now() < deadline) {
      const end = Math.min(i + 150, rows.length);
      for (; i < end; i++) {
        const n = normalizeAwinRow(rows[i], cfg);
        if (!n) continue;
        await upsertByExternalId(n, cfg.advertiser).catch(() => {});
      }
      rowIdx = i;
      await save();
    }
    if (rowIdx >= rows.length) {
      fi++;
      rowIdx = 0;
      await save();
    } else {
      return; // budget estourou no meio do feed — retoma na proxima invocacao
    }
  }

  if (fi >= feeds.length) {
    const meta = await prisma.syncState.findUnique({ where: { key: META_KEY } });
    if (meta?.lastCycleAt) await reconcileAwin(meta.lastCycleAt);
    await prisma.syncState.update({
      where: { key: STATE_KEY },
      data: { phase: "done", page: 0, lastCycleAt: new Date() },
    });
  }
}

async function runAwinLocked() {
  const hb = startHeartbeat(STATE_KEY);
  try {
    await runAwCycle();
    await clearError(STATE_KEY);
  } catch (e) {
    console.error("[awin] ciclo falhou:", e);
    await noteError(STATE_KEY, e instanceof Error ? e.message : String(e));
  } finally {
    await releaseLock(STATE_KEY, hb);
  }
}

// Chamado via after() nas paginas/cron: nunca bloqueia a resposta
export async function maybeSyncAwin(force = false) {
  if (awinFeeds().length === 0) return;

  await prisma.syncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, phase: "f:0", page: 0 },
    update: {},
  });
  const state = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!state) return;

  const now = Date.now();
  const lockFresh = state.busyAt && now - state.busyAt.getTime() < LOCK_STALE_MS;
  const cycleFresh =
    !force &&
    state.phase === "done" &&
    state.lastCycleAt &&
    now - state.lastCycleAt.getTime() < CYCLE_TTL_MS;
  if (lockFresh || cycleFresh) return;
  if (!force && (await errorBackoffActive(STATE_KEY))) return;
  if (!(await acquireLock(STATE_KEY))) return;

  await runAwinLocked();
}

// Versao forcada p/ o botao "Sincronizar agora" do /admin
export async function startAwinSync(): Promise<{
  status: "started" | "busy" | "skipped";
  run?: () => Promise<void>;
}> {
  if (awinFeeds().length === 0) return { status: "skipped" };

  await prisma.syncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, phase: "f:0", page: 0 },
    update: {},
  });
  const state = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!state) return { status: "skipped" };
  if (busyFresh(state.busyAt) || !(await acquireLock(STATE_KEY))) {
    return { status: "busy" };
  }
  return { status: "started", run: runAwinLocked };
}

// Rate limit in-memory por chave (IP, endpoint). O site roda em
// container unico — Map em processo e suficiente; nao precisa de
// Redis nem de middleware edge.
//
// Protege os endpoints publicos (/api/pv, /api/notify, /api/search)
// de flood que inflaria Click/Event/Subscriber e estouraria o disco
// do Supabase free. Janela fixa: `limit` hits por `windowMs`.

const hits = new Map<string, { n: number; reset: number }>();
const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  // varredura preguiçosa quando o mapa cresce — sem timers
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const e = hits.get(key);
  if (!e || e.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (e.n >= limit) return false;
  e.n++;
  return true;
}

// IP do cliente: primeiro IP do x-forwarded-for (cloudflared/tunnel
// repassa). Sem header = "local" (dev/self-request).
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 60) || "local";
  return req.headers.get("x-real-ip")?.slice(0, 60) || "local";
}

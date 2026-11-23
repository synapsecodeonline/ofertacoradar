// Cache em memoria (TTL) para respostas pesadas geradas no servidor.
// O site e self-hosted (container longevo) — um Map simples evita
// bater no Supabase a cada request de crawler/bot. Dados ficam no max
// `ttlMs` atrasados, aceitavel para sitemap/feed/catalogo.
const store = new Map<string, { at: number; value: string }>();
const MAX_KEYS = 500;

export async function memoTtl(
  key: string,
  ttlMs: number,
  fn: () => Promise<string>,
): Promise<string> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  if (store.size >= MAX_KEYS) store.clear();
  store.set(key, { at: Date.now(), value });
  return value;
}

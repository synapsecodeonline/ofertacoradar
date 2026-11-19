// Detecta sessao de admin logado (Supabase SSR) sem chamar a API de auth.
// O cookie de sessao segue o padrao `sb-<ref>-auth-token` (pode vir
// chunked como `...-auth-token.0`). Usado para nao contabilizar
// pageviews/cliques do proprio admin nas estatisticas.
export function hasAdminSession(cookieHeader: string | null): boolean {
  return !!cookieHeader && /sb-[^=;\s]*auth-token/.test(cookieHeader);
}

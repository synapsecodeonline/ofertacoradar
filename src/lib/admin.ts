// Allowlist de admin: so emails listados acessam /admin e as rotas
// /api/admin/*. Antes qualquer conta Supabase logada era "admin" —
// se o signup estiver aberto, qualquer um exportava dados e
// disparava scrapes.
//
//   ADMIN_EMAILS="voce@x.com,outro@x.com"  (csv, case-insensitive)
//   fallback: KIT_EMAIL (quem recebe o kit diario e o dono)
// Fail-closed: sem nenhuma das envs, ninguem e admin.
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.KIT_EMAIL || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

// Versao async: valida a sessao Supabase E o email na allowlist.
// Import dinamico para nao carregar next/headers em contexto de teste.
export async function isAdmin(): Promise<boolean> {
  const { createClient } = await import("./supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return isAdminEmail(data.user?.email);
}

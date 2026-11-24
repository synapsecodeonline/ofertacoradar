// Escape de campo CSV (RFC 4180): envolve em aspas quando contem
// virgula, aspas ou quebra de linha; aspas internas duplicam.
export function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

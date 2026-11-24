// timeAgo compartilhado pelas paginas admin (mesma formatacao).
export function timeAgo(
  d: Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!d) return "nunca";
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

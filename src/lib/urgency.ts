export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function urgencyLabel(endsAt: Date | null | undefined): string | null {
  const d = daysUntil(endsAt);
  if (d === null) return null;
  if (d < 0) return "Encerrada";
  if (d === 0) return "Termina hoje";
  if (d === 1) return "Termina amanhã";
  if (d <= 7) return `Termina em ${d} dias`;
  return null;
}

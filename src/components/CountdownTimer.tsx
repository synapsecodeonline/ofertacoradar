"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  if (now === null) return null;
  const diff = target - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const parts =
    days > 0
      ? [
          `${days}d`,
          `${pad(hours)}h`,
          `${pad(minutes)}m`,
          `${pad(seconds)}s`,
        ]
      : [`${pad(hours)}h`, `${pad(minutes)}m`, `${pad(seconds)}s`];

  return (
    <div className="flex items-center gap-1.5" aria-label="Tempo restante da oferta">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-amber-500">:</span>}
          <span className="rounded-md bg-zinc-900 px-2 py-1 font-mono text-sm font-bold tabular-nums text-amber-300 dark:bg-zinc-800">
            {p}
          </span>
        </span>
      ))}
    </div>
  );
}

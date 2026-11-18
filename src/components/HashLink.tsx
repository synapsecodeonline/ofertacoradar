"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Link com hash (#catalogo etc.) que funciona de verdade no App Router.
 *
 * A navegacao com searchParams novos e lenta (~segundos) e o Next pode
 * resetar o scroll quando o novo payload comita — por isso o scrollIntoView
 * e retentado varias vezes durante a transicao, sempre ganhando do reset.
 */
export default function HashLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const router = useRouter();
  const [path, hash] = href.split("#");

  const scrollToHash = () => {
    if (!hash) return;
    document
      .getElementById(hash)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (!hash) return; // sem hash: comportamento padrao do Link
    e.preventDefault();
    router.push(path, { scroll: false });
    // retenta durante ~3s: cobre o tempo da navegacao e resets de scroll
    for (const t of [50, 200, 500, 900, 1500, 2200, 3000]) {
      setTimeout(scrollToHash, t);
    }
  };

  return (
    <Link href={href} scroll={false} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}

/** Versao para submit de formulario/search: mesma logica de retentativa. */
export function scrollToCatalogWithRetries() {
  const scroll = () =>
    document
      .getElementById("catalogo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  for (const t of [50, 200, 500, 900, 1500, 2200, 3000]) {
    setTimeout(scroll, t);
  }
}

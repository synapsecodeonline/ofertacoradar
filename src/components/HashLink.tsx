"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { markScrollTo } from "@/components/CatalogScrollOnNav";

/**
 * Link com hash (#catalogo etc.) que funciona no App Router.
 *
 * A navegacao com searchParams novos e lenta e o Next reseta o scroll
 * quando o novo payload comita — por isso o clique so deixa uma flag
 * (markScrollTo) e o CatalogScrollOnNav rola DEPOIS do commit.
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

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (!hash) return; // sem hash: comportamento padrao do Link
    e.preventDefault();
    markScrollTo(hash);
    router.push(path, { scroll: false });
  };

  return (
    <Link href={href} scroll={false} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}

/** Versao para submit de formulario/search: mesma flag do HashLink. */
export function scrollToCatalogOnNav() {
  markScrollTo("catalogo");
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Link com hash (#catalogo etc.) que funciona de verdade no App Router:
 * o router.push com searchParams novos rolaria pro topo ignorando o hash,
 * entao navegamos com scroll:false e fazemos scrollIntoView manual.
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
    router.push(path, { scroll: false });
    const scroll = () =>
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    // #catalogo ja existe na pagina atual; rola ja e de novo apos o render
    requestAnimationFrame(scroll);
    setTimeout(scroll, 400);
  };

  return (
    <Link href={href} scroll={false} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}

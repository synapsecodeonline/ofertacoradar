"use client";

// Botao de download do kit: baixa a imagem E copia a legenda
// pra area de transferencia no mesmo clique.
export default function KitDownload({
  href,
  fileName,
  caption,
  label,
  primary,
}: {
  href: string;
  fileName: string;
  caption: string;
  label: string;
  primary?: boolean;
}) {
  function handleClick() {
    const text = caption;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
  }

  return (
    <a
      href={href}
      download={fileName}
      onClick={handleClick}
      title="Baixa a imagem e copia a legenda"
      className={
        primary
          ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-300"
      }
    >
      {label}
    </a>
  );
}

function fallbackCopy(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  } catch {
    // clipboard indisponivel — usuario copia manual pelo botao legenda
  }
}

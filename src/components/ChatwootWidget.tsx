"use client";

import Script from "next/script";

// Widget de chat do Chatwoot self-hosted. Os valores sao publicos por
// design (websiteToken identifica o site, nao e segredo). Podem ser
// sobrescritos via env sem deploy de codigo.
const BASE_URL =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL ?? "https://chat.ofertacoradar.com.br";
const WEBSITE_TOKEN =
  process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN ?? "MXgaVtRYrRwZkG5BZQftAYhK";

export default function ChatwootWidget() {
  return (
    <Script id="chatwoot-sdk" strategy="afterInteractive">
      {`(function(d,t){var BASE_URL=${JSON.stringify(BASE_URL)};var g=d.createElement(t),s=d.getElementsByTagName(t)[0];g.src=BASE_URL+"/packs/js/sdk.js";g.async=true;s.parentNode.insertBefore(g,s);g.onload=function(){window.chatwootSDK.run({websiteToken:${JSON.stringify(WEBSITE_TOKEN)},baseUrl:BASE_URL})}})(document,"script");`}
    </Script>
  );
}

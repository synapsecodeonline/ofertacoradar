const urls = [
  "https://lmdee.link/jSV4MXoBuIWb",
  "https://www.rovitex.com.br/blusa-feminina-over-com-estampa-e-glitter-rovitex-bege-617241022/p?utm_source=lomadee&utm_medium=link_generator",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
async function main() {
  for (let round = 0; round < 3; round++) {
    for (const u of urls) {
      try {
        const res = await fetch(u, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
        const html = await res.text();
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g," ").trim().slice(0,60) ?? "";
        console.log(`r${round}`, res.status, "|", u.slice(0, 45), "->", title.slice(0, 55));
      } catch (e) { console.log(`r${round} ERR`, u.slice(0,45), e instanceof Error ? e.message : e); }
      await new Promise(r => setTimeout(r, 800));
    }
  }
}
main();

// Kit diario do Instagram: gera reel MP4 + cards PNG + legendas e
// envia tudo por email (Resend). Roda via cron: npm run kit:daily
//
// Env necessarias:
//   RESEND_API_KEY  — chave da API do Resend (resend.com)
//   KIT_EMAIL       — email que recebe o kit diario
//   CRON_SECRET     — ja existe; libera /api/card sem login
// Sem RESEND_API_KEY o kit e salvo em ./kit-out/ (modo teste).

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getInstagramKit, type KitItem } from "../src/lib/instagramKit";
import { formatPrice } from "../src/lib/format";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require("ffmpeg-static");

const W = 1080;
const H = 1920;
const CLIP_S = 4;
const OUT_DIR = join(process.cwd(), "kit-out");
// siteUrl() cairia em localhost fora da Vercel — forca o dominio real
// para links dos cards/legendas e download dos PNGs.
process.env.NEXT_PUBLIC_SITE_URL ??= "https://ofertacoradar.vercel.app";

// ASS: cores em &HAABBGGRR. Styles usados nos eventos.
const STYLES = `
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,DejaVu Sans,58,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,2,1,5,40,40,0,1
Style: Meta,DejaVu Sans,48,&H00E4F699,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,2,1,5,40,40,0,1
Style: Price,DejaVu Sans,100,&H0034D399,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,1,5,40,40,0,1
Style: Badge,DejaVu Sans,84,&H00FFFFFF,&H000000FF,&H002626DC,&H00000000,-1,0,0,0,100,100,0,0,3,22,0,5,40,40,0,1
Style: Foot,DejaVu Sans,42,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,3,16,0,5,40,40,0,1
Style: Big,DejaVu Sans,110,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,1,5,40,40,0,1
Style: Sub,DejaVu Sans,56,&H00E4F699,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,2,1,5,40,40,0,1
Style: Url,DejaVu Sans,52,&H00E4F699,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,2,1,5,40,40,0,1
`;

type Ev = { text: string; y: number; style: string };

function assFile(dir: string, name: string, events: Ev[], dur = CLIP_S): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");
  const body = events
    .map(
      (e) =>
        `Dialogue: 0,0:00:00.00,0:00:0${dur}.00,${e.style},,0,0,0,,{\\pos(540,${e.y})}${esc(e.text)}`,
    )
    .join("\n");
  const p = join(dir, `${name}.ass`);
  writeFileSync(
    p,
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n${STYLES}\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${body}\n`,
    "utf8",
  );
  return p;
}

const run = (args: string[]) =>
  execFileSync(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "pipe",
  });

async function download(url: string, dest: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return false;
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// Clip de texto puro (intro/outro)
function textClip(dir: string, name: string, events: Ev[]) {
  const ass = assFile(dir, name, events);
  const out = join(dir, `${name}.mp4`);
  run([
    "-f", "lavfi", "-t", String(CLIP_S), "-i", `color=c=0x042f2e:s=${W}x${H}`,
    "-f", "lavfi", "-t", String(CLIP_S), "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", `subtitles=${ass}`,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

// Clip de produto: imagem central + legendas ASS
function productClip(dir: string, name: string, item: KitItem, imgPath: string) {
  const titleLines = wrap(item.title, 30);
  const price = item.price != null ? formatPrice(item.price, item.currency) : null;
  const disc = item.discountPct ?? null;
  const meta = [item.merchant, price].filter(Boolean).join("   ·   ");

  const events: Ev[] = [
    { text: titleLines.join("\\N"), y: 330, style: "Title" },
    ...(meta ? [{ text: meta, y: 1520, style: "Meta" }] : []),
    ...(disc !== null && disc > 0
      ? [{ text: `-${disc}% OFF`, y: 1660, style: "Badge" }]
      : []),
    { text: "LINK NA BIO — ofertacoradar.vercel.app/ofertas", y: 1840, style: "Foot" },
  ];
  const ass = assFile(dir, name, events);

  const out = join(dir, `${name}.mp4`);
  run([
    "-loop", "1", "-framerate", "30", "-t", String(CLIP_S), "-i", imgPath,
    "-f", "lavfi", "-t", String(CLIP_S), "-i", `color=c=0x042f2e:s=${W}x${H}`,
    "-f", "lavfi", "-t", String(CLIP_S), "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    `[0:v]scale=880:-2:force_original_aspect_ratio=decrease[prod];` +
      `[1:v][prod]overlay=(W-w)/2:400[v0];` +
      `[v0]subtitles=${ass},fade=t=in:st=0:d=0.4,fade=t=out:st=${CLIP_S - 0.4}:d=0.4,format=yuv420p[vout]`,
    "-map", "[vout]", "-map", "2:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
    "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

// Cronograma de postagem — horarios de pico do publico de ofertas
// no Brasil (almoco ~12h, fim de tarde ~18h, noite ~20-21h).
function buildCronograma(items: KitItem[]): string {
  const [a, b, c, d] = items;
  const L: string[] = [
    "CRONOGRAMA DE POSTAGEM — Kit do dia",
    "=====================================",
    "",
    "REGRA DE OURO: nao poste tudo de uma vez.",
    "Espalhe ao longo do dia — cada post e um toque novo",
    "no algoritmo e mais uma chance de clique.",
    "",
    "12h00  REELS (arquivo reel-*.mp4)",
    "       -> posta nos Reels E no feed (o reel aparece nos dois)",
    "       -> legenda: item 1 do legendas.txt",
    "       -> e o formato que mais alcanca gente nova",
    "",
    "15h00  STORY 1",
    "       -> imagem: 01-*-story.png",
    "       -> legenda do item 1 nos stories",
    "       -> sticker de link: https://ofertacoradar.vercel.app/produto/" + a.id,
    "",
    "18h00  STORY 2",
    "       -> imagem: 02-*-story.png",
    "       -> legenda do item 2",
    "",
    "20h00  POST FEED",
    "       -> imagem: 01-*-feed.png (card quadrado)",
    "       -> legenda completa do item 1 (a melhor oferta do dia)",
    "       -> esse post fica no perfil — e vitrine permanente",
    "",
    "21h00  STORY 3 + 4",
    "       -> imagens: 03 e 04 *-story.png",
    "       -> legendas dos itens 3 e 4",
    "       -> feche o dia lembrando: LINK NA BIO",
    "",
    "DICA: nos stories use o sticker 'link' apontando direto",
    "para a pagina do produto — converte mais que 'link na bio'.",
  ];
  if (b) L.push("", `Item 2 do dia: ${b.title}`);
  if (c) L.push(`Item 3 do dia: ${c.title}`);
  if (d) L.push(`Item 4 do dia: ${d.title}`);
  return L.join("\n") + "\n";
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function main() {
  console.log("Gerando kit diario...");
  const kit = await getInstagramKit(4);
  if (kit.items.length === 0) {
    console.log("Nenhuma oferta valida hoje — kit vazio.");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  mkdirSync(OUT_DIR, { recursive: true });

  // 1) Clips do reel
  const clips: string[] = [];
  clips.push(
    textClip(dir, "intro", [
      { text: "OFERTAÇO RADAR", y: 780, style: "Big" },
      { text: "OFERTAS VERIFICADAS TODO DIA", y: 960, style: "Sub" },
      { text: "MAIORES DESCONTOS DO MOMENTO", y: 1060, style: "Url" },
    ]),
  );

  const attachments: { filename: string; content: string }[] = [];
  const captions: string[] = [];

  for (const [i, item] of kit.items.entries()) {
    const img = join(dir, `prod-${i}.jpg`);
    const hasImg = item.imageUrl ? await download(item.imageUrl, img) : false;

    let clip: string;
    if (hasImg) {
      try {
        clip = productClip(dir, `p${i}`, item, img);
      } catch (e) {
        console.log(`Clip ${i} falhou, usando texto:`, String(e).slice(0, 140));
        clip = textClip(dir, `p${i}`, [
          { text: wrap(item.title, 30).join("\\N"), y: 700, style: "Title" },
          ...(item.price != null
            ? [{ text: formatPrice(item.price, item.currency) ?? "", y: 1150, style: "Price" }]
            : []),
          { text: "LINK NA BIO", y: 1840, style: "Foot" },
        ]);
      }
    } else {
      clip = textClip(dir, `p${i}`, [
        { text: wrap(item.title, 30).join("\\N"), y: 700, style: "Title" },
        ...(item.price != null
          ? [{ text: formatPrice(item.price, item.currency) ?? "", y: 1150, style: "Price" }]
          : []),
        { text: "LINK NA BIO", y: 1840, style: "Foot" },
      ]);
    }
    clips.push(clip);

    // 2) Cards PNG (feed + story) via /api/card com chave do cron
    const key = process.env.CRON_SECRET ?? "";
    for (const size of ["feed", "story"] as const) {
      const cardPath = join(dir, `card-${i}-${size}.png`);
      if (
        await download(
          `${kit.siteUrl}/api/card/${item.id}?size=${size}&key=${key}`,
          cardPath,
        )
      ) {
        attachments.push({
          filename: `${String(i + 1).padStart(2, "0")}-${slug(item.title)}-${size}.png`,
          content: readFileSync(cardPath).toString("base64"),
        });
      }
    }

    captions.push(
      `=== ${i + 1}. ${item.title} ===\n${item.caption}\nLink: ${item.pageUrl}\n`,
    );
  }

  clips.push(
    textClip(dir, "outro", [
      { text: "LINK NA BIO", y: 800, style: "Big" },
      { text: "ofertacoradar.vercel.app/ofertas", y: 990, style: "Url" },
    ]),
  );

  // 3) Concatena o reel
  const listFile = join(dir, "concat.txt");
  writeFileSync(listFile, clips.map((c) => `file '${c}'`).join("\n"));
  const reelPath = join(dir, "reel.mp4");
  try {
    run(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", reelPath]);
  } catch {
    run([
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
      "-pix_fmt", "yuv420p", "-c:a", "aac", reelPath,
    ]);
  }

  const reelName = `reel-${new Date().toISOString().slice(0, 10)}.mp4`;
  attachments.unshift({
    filename: reelName,
    content: readFileSync(reelPath).toString("base64"),
  });
  attachments.push({
    filename: "legendas.txt",
    content: Buffer.from(captions.join("\n")).toString("base64"),
  });

  // 5) Cronograma de postagem — formato que maximiza alcance
  const cronograma = buildCronograma(kit.items);
  attachments.push({
    filename: "cronograma.txt",
    content: Buffer.from(cronograma).toString("base64"),
  });

  // 4) Copia tudo para kit-out (backup local)
  writeFileSync(join(OUT_DIR, reelName), readFileSync(reelPath));
  writeFileSync(join(OUT_DIR, "legendas.txt"), captions.join("\n"));
  writeFileSync(join(OUT_DIR, "cronograma.txt"), cronograma);
  for (const a of attachments) {
    if (a.filename.endsWith(".png")) {
      writeFileSync(join(OUT_DIR, a.filename), Buffer.from(a.content, "base64"));
    }
  }

  // 5) Envia por email (Resend)
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.KIT_EMAIL;
  if (!apiKey || !to) {
    console.log(`Sem RESEND_API_KEY/KIT_EMAIL — kit salvo em ${OUT_DIR}`);
    console.log(`Reel: ${join(OUT_DIR, reelName)} (${kit.items.length} ofertas)`);
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h1 style="color:#059669">Kit do dia — ${new Date().toLocaleDateString("pt-BR")}</h1>
      <p>Anexo: <b>reel.mp4</b> pronto pra postar + ${kit.items.length} cards de feed + legendas.</p>
      <ol>
        ${kit.items
          .map(
            (it) =>
              `<li><b>${it.title}</b> — ${it.price != null ? formatPrice(it.price, it.currency) : ""}</li>`,
          )
          .join("")}
      </ol>
      <p style="color:#71717a;font-size:12px">Poste o reel no Reels e os cards nos stories. Legendas em legendas.txt.</p>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Ofertaço Radar <onboarding@resend.dev>",
      to: to.split(",").map((e) => e.trim()).filter(Boolean),
      subject: `Kit do dia — ${kit.items.length} ofertas (${new Date().toLocaleDateString("pt-BR")})`,
      html,
      attachments,
    }),
  });
  if (!r.ok) {
    console.error("Resend falhou:", r.status, await r.text());
    console.log(`Kit salvo em ${OUT_DIR} como fallback.`);
    process.exit(1);
  }
  console.log(`Kit enviado para ${to} — ${kit.items.length} ofertas, reel ${reelName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

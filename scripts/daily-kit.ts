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
import { canonicalCategory } from "../src/lib/categories";

// Cronograma semanal: cada dia tem um tema que guia a selecao das
// ofertas e o texto do reel/email. getDay(): 0=dom ... 6=sab.
const THEMES: Record<number, { nome: string; sub: string; cats: string[] }> = {
  1: { nome: "TECH & ELETRÔNICOS", sub: "Celulares, games, informática e gadgets", cats: ["eletronicos", "celulares", "informatica", "games", "tv-audio", "fotografia", "software", "eletronicos-infantil"] },
  2: { nome: "CASA & DECORAÇÃO", sub: "Móveis, cozinha, eletro e organização", cats: ["casa-decoracao", "decoracao", "iluminacao", "textil-cama", "moveis", "cozinha", "eletrodomesticos", "eletro-cocina", "eletro-limpeza", "climatizacao", "organizacao"] },
  3: { nome: "BELEZA & CUIDADOS", sub: "Skincare, maquiagem, cabelo e saúde", cats: ["beleza", "maquiagem", "skincare", "cabelo", "perfumaria", "saude", "suplementos", "beleza-infantil"] },
  4: { nome: "MODA & ESTILO", sub: "Roupas, calçados, bolsas e acessórios", cats: ["moda-feminina", "moda-masculina", "moda-infantil", "calcados", "calcados-infantil", "bolsas-mochilas", "acessorios-moda", "oculos", "joias-relogios", "moda-praia", "moda-praia-infantil", "lingerie", "vestidos", "calcas", "blusas"] },
  5: { nome: "ESPORTE & FITNESS", sub: "Academia, ciclismo, camping e lazer", cats: ["esporte-lazer", "fitness", "ciclismo", "camping", "esporte-infantil"] },
  6: { nome: "MERCADO & LAR", sub: "Supermercado, pets, bebê e limpeza", cats: ["supermercado", "mercearia", "limpeza-higiene", "alimentos-bebidas", "pets", "bebe", "brinquedos"] },
  0: { nome: "ACHADINHOS & SURPRESAS", sub: "Os maiores descontos do momento, de tudo", cats: ["ofertas"] },
};

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

function themeOf(d = new Date()) {
  return { dia: DIAS[d.getDay()], ...THEMES[d.getDay()] };
}

// Seleciona 4 itens priorizando os do tema do dia; completa com os
// melhores gerais quando o tema tem poucas ofertas.
function pickForTheme(items: KitItem[], theme: ReturnType<typeof themeOf>, n = 4) {
  const match = items.filter((it) =>
    theme.cats.includes(canonicalCategory(it.category)),
  );
  const rest = items.filter((it) => !match.includes(it));
  return [...match, ...rest].slice(0, n);
}

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
    const r = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "OfertaçoRadar/1.0 (kit diario; synapsecode.online@gmail.com)" },
    });
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

// Musica de fundo: Funky Souls (Amarià) — CC-BY 3.0, via Wikimedia Commons.
// Baixada uma vez por execucao; se falhar, o reel sai sem musica.
const MUSIC_URL =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/Amari%C3%A0_-_Funky_Souls_(2019).mp3";

// Grade cinematico: contraste/saturacao, grao sutil e vinheta.
const GRADE = "eq=contrast=1.06:saturation=1.12,noise=alls=5:allf=t,vignette=angle=PI/4.5";

// Audio de fundo: fatia da musica no offset do clip (ou silencio)
function audioInput(music: string | null, offsetS: number): string[] {
  if (!music) {
    return ["-f", "lavfi", "-t", "4.5", "-i", "anullsrc=r=44100:cl=stereo"];
  }
  return ["-ss", String(offsetS), "-t", "4.5", "-i", music];
}

function audioMap(vol: number) {
  return ["-af", `volume=${vol}`];
}

// Clip de texto puro (intro/outro)
function textClip(
  dir: string,
  name: string,
  events: Ev[],
  music: string | null,
  offsetS: number,
) {
  const ass = assFile(dir, name, events);
  const out = join(dir, `${name}.mp4`);
  run([
    "-f", "lavfi", "-t", String(CLIP_S + 0.3), "-i", `color=c=0x042f2e:s=${W}x${H}`,
    ...audioInput(music, offsetS),
    "-vf", `subtitles=${ass},${GRADE},fade=t=in:st=0:d=0.4,fade=t=out:st=${CLIP_S - 0.4}:d=0.4,format=yuv420p`,
    "-map", "0:v", "-map", "1:a",
    ...audioMap(0.2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

// Clip de produto: Ken Burns na imagem + legendas ASS + grade
function productClip(
  dir: string,
  name: string,
  item: KitItem,
  imgPath: string,
  music: string | null,
  offsetS: number,
) {
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
  // zoompan gera o proprio movimento (Ken Burns) — zoom sutil de 1.0 a ~1.12
  run([
    "-i", imgPath,
    "-f", "lavfi", "-t", String(CLIP_S + 0.3), "-i", `color=c=0x042f2e:s=${W}x${H}`,
    ...audioInput(music, offsetS),
    "-filter_complex",
    `[0:v]scale=1760:-2:force_original_aspect_ratio=decrease,` +
      `zoompan=z='min(1+0.0012*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
      `d=${CLIP_S * 30}:s=880x1100:fps=30[prod];` +
      `[1:v][prod]overlay=(W-w)/2:390:shortest=1[v0];` +
      `[v0]subtitles=${ass},${GRADE},` +
      `fade=t=in:st=0:d=0.4,fade=t=out:st=${CLIP_S - 0.4}:d=0.4,format=yuv420p[vout]`,
    "-map", "[vout]", "-map", "2:a",
    ...audioMap(0.22),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
    "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

// Clip a partir do card story (1080x1920): Ken Burns + grade + fade.
// E a mesma imagem que vai pro story — video e card ficam identicos.
function cardClip(
  dir: string,
  name: string,
  cardPath: string,
  music: string | null,
  offsetS: number,
) {
  const out = join(dir, `${name}.mp4`);
  run([
    "-i", cardPath,
    ...audioInput(music, offsetS),
    "-filter_complex",
    `[0:v]scale=2160:3840:force_original_aspect_ratio=decrease,` +
      `zoompan=z='min(1+0.0012*on,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
      `d=${CLIP_S * 30}:s=${W}x${H}:fps=30,` +
      `${GRADE},fade=t=in:st=0:d=0.4,fade=t=out:st=${CLIP_S - 0.4}:d=0.4,format=yuv420p[vout]`,
    "-map", "[vout]", "-map", "1:a",
    ...audioMap(0.22),
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  const theme = themeOf();
  const pool = await getInstagramKit(12);
  const items = pickForTheme(pool.items, theme, 4);
  if (items.length === 0) {
    console.log("Nenhuma oferta valida hoje — kit vazio.");
    return;
  }
  const kit = { ...pool, items };

  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  mkdirSync(OUT_DIR, { recursive: true });

  // Musica de fundo (uma vez por execucao)
  const musicPath = join(dir, "music.mp3");
  const music = (await download(MUSIC_URL, musicPath)) ? musicPath : null;
  if (!music) console.log("Musica indisponivel — reel sai sem fundo.");

  // 1) Clips do reel — cada clip recebe uma fatia da musica (offset)
  const clips: string[] = [];
  clips.push(
    textClip(
      dir,
      "intro",
      [
        { text: "OFERTAÇO RADAR", y: 740, style: "Big" },
        { text: theme.nome, y: 920, style: "Sub" },
        { text: theme.sub.toUpperCase(), y: 1010, style: "Url" },
        { text: "OFERTAS VERIFICADAS TODO DIA", y: 1120, style: "Url" },
      ],
      music,
      0,
    ),
  );

  const attachments: { filename: string; content: string }[] = [];
  const captions: string[] = [];

  const cardKey = process.env.CRON_SECRET ?? "";

  for (const [i, item] of kit.items.entries()) {
    const offset = (i + 1) * CLIP_S;

    // Cards primeiro: o reel usa o MESMO card story do post —
    // video e imagem sempre condizentes com o tema do dia.
    const storyPath = join(dir, `card-${i}-story.png`);
    const feedPath = join(dir, `card-${i}-feed.png`);
    const hasStory = await download(
      `${kit.siteUrl}/api/card/${item.id}?size=story&key=${cardKey}`,
      storyPath,
    );
    const hasFeed = await download(
      `${kit.siteUrl}/api/card/${item.id}?size=feed&key=${cardKey}`,
      feedPath,
    );
    if (hasStory) {
      attachments.push({
        filename: `${String(i + 1).padStart(2, "0")}-${slug(item.title)}-story.png`,
        content: readFileSync(storyPath).toString("base64"),
      });
    }
    if (hasFeed) {
      attachments.push({
        filename: `${String(i + 1).padStart(2, "0")}-${slug(item.title)}-feed.png`,
        content: readFileSync(feedPath).toString("base64"),
      });
    }

    const fallbackEvents: Ev[] = [
      { text: wrap(item.title, 30).join("\\N"), y: 700, style: "Title" },
      ...(item.price != null
        ? [{ text: formatPrice(item.price, item.currency) ?? "", y: 1150, style: "Price" }]
        : []),
      { text: "LINK NA BIO", y: 1840, style: "Foot" },
    ];

    let clip: string | null = null;
    if (hasStory) {
      try {
        clip = cardClip(dir, `p${i}`, storyPath, music, offset);
      } catch (e) {
        console.log(`Clip ${i} (card) falhou:`, String(e).slice(0, 140));
      }
    }
    if (!clip && item.imageUrl) {
      const img = join(dir, `prod-${i}.jpg`);
      if (await download(item.imageUrl, img)) {
        try {
          clip = productClip(dir, `p${i}`, item, img, music, offset);
        } catch (e) {
          console.log(`Clip ${i} (foto) falhou:`, String(e).slice(0, 140));
        }
      }
    }
    if (!clip) {
      clip = textClip(dir, `p${i}`, fallbackEvents, music, offset);
    }
    clips.push(clip);

    captions.push(
      `=== ${i + 1}. ${item.title} ===\n${item.caption}\nLink: ${item.pageUrl}\n`,
    );
  }

  clips.push(
    textClip(
      dir,
      "outro",
      [
        { text: "LINK NA BIO", y: 800, style: "Big" },
        { text: "ofertacoradar.vercel.app/ofertas", y: 990, style: "Url" },
      ],
      music,
      (kit.items.length + 1) * CLIP_S,
    ),
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
  // Cronograma de postagem — formato que maximiza alcance
  const cronograma = buildCronograma(kit.items);

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

  const itemCard = (it: KitItem, i: number, slot: string) => `
    <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px;margin:12px 0">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#059669">${slot}</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:800;color:#18181b">${i + 1}. ${it.title}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#52525b">
        ${it.price != null ? formatPrice(it.price, it.currency) : ""}
        ${it.merchant ? ` · ${it.merchant}` : ""}
        ${it.discountPct ? ` · <b style="color:#dc2626">-${it.discountPct}%</b>` : ""}
      </p>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#71717a">LEGENDA (copiar e colar):</p>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;background:#f4f4f5;border-radius:8px;padding:10px;margin:0 0 8px">${escapeHtml(it.caption)}</pre>
      <p style="margin:0;font-size:12px"><a href="${it.pageUrl}" style="color:#059669">${it.pageUrl}</a></p>
    </div>`;

  const semana = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => {
      const t = themeOf(new Date(Date.now() - ((new Date().getDay() - d + 7) % 7) * 86400000));
      return `${t.dia}: ${t.nome}`;
    })
    .join(" &nbsp;·&nbsp; ");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#18181b">
      <h1 style="color:#059669;margin-bottom:4px">${theme.dia} — ${theme.nome}</h1>
      <p style="color:#71717a;font-size:13px;margin-top:0">${theme.sub}. Siga a ordem abaixo — imagens/vídeo anexos.</p>

      <div style="background:#f4f4f5;border-radius:10px;padding:10px 14px;margin:12px 0;font-size:12px;color:#52525b;line-height:1.7">
        <b>Cronograma da semana:</b> ${semana}
      </div>

      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px;margin:16px 0;font-size:13px;line-height:1.6">
        <b>12h</b> — posta o <b>reel-*.mp4</b> nos Reels (legenda = item 1 abaixo)<br>
        <b>15h</b> — story com a imagem <b>01-*-story.png</b> + legenda do item 1<br>
        <b>18h</b> — story com <b>02-*-story.png</b> + legenda do item 2<br>
        <b>20h</b> — post no feed com <b>01-*-feed.png</b> + legenda completa do item 1<br>
        <b>21h</b> — stories <b>03 e 04 *-story.png</b> + legendas dos itens 3 e 4
      </div>

      ${kit.items.map((it, i) => itemCard(it, i, ["REEL + STORY + FEED", "STORY", "STORY", "STORY"][i] ?? "STORY")).join("")}

      <p style="color:#71717a;font-size:12px;margin-top:16px">
        Nos stories, use o sticker de link apontando pra página do produto (converte mais que "link na bio").
        As ofertas não expiram — pode repostar as que performarem melhor.
      </p>
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
      subject: `${theme.dia} — ${theme.nome} · ${kit.items.length} ofertas`,
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

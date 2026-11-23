// Relatorio semanal de uso de disco do Supabase: tamanho do banco,
// top tabelas e % do limite do plano. Envia por email (Resend).
// Roda via GitHub Actions (workflow db-disk) ou manual:
//   npm run db:disk
//
// Env:
//   DATABASE_URL       — obrigatoria
//   RESEND_API_KEY     — obrigatoria p/ enviar email
//   KIT_EMAIL          — destinatario (fallback de DB_DISK_EMAIL)
//   RESEND_FROM        — remetente
//   DB_DISK_LIMIT_MB   — limite do plano em MB (default 500 = free)
import { prisma } from "../src/lib/db";

const LIMIT_MB = Number(process.env.DB_DISK_LIMIT_MB ?? 500);

const mb = (n: number | bigint) => Number(n) / 1048576;
const fmt = (n: number | bigint) => `${mb(n).toFixed(1)} MB`;

async function main() {
  const [{ size: dbBytes }] = await prisma.$queryRawUnsafe(
    `SELECT pg_database_size(current_database()) AS size`,
  ) as { size: bigint }[];

  const tables = (await prisma.$queryRawUnsafe(
    `SELECT relname AS tabela, pg_total_relation_size(relid) AS bytes
     FROM pg_catalog.pg_statio_user_tables
     WHERE schemaname = 'ofertacoradar'
     ORDER BY bytes DESC LIMIT 10`,
  )) as { tabela: string; bytes: bigint }[];

  const pct = (mb(dbBytes) / LIMIT_MB) * 100;
  const today = new Date().toISOString().slice(0, 10);

  const rows = tables
    .map((t) => `<tr><td style="padding:4px 12px">${t.tabela}</td><td style="padding:4px 12px;text-align:right">${fmt(t.bytes)}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
      <h2 style="color:#059669;margin-bottom:4px">💾 Disco Supabase — ${today}</h2>
      <p style="color:#71717a;font-size:13px;margin-top:0">Uso do banco ofertacoradar (plano free = ${LIMIT_MB} MB)</p>
      <div style="background:${pct > 80 ? "#fef2f2" : pct > 60 ? "#fffbeb" : "#ecfdf5"};border:1px solid ${pct > 80 ? "#fecaca" : pct > 60 ? "#fde68a" : "#a7f3d0"};border-radius:12px;padding:16px;margin:12px 0;text-align:center">
        <div style="font-size:40px;font-weight:900;color:${pct > 80 ? "#dc2626" : pct > 60 ? "#d97706" : "#059669"}">${pct.toFixed(1)}%</div>
        <div style="font-size:14px;color:#52525b">${fmt(dbBytes)} de ${LIMIT_MB} MB</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f4f4f5;border-radius:10px">
        <tr><th style="text-align:left;padding:8px 12px">Tabela</th><th style="text-align:right;padding:8px 12px">Tamanho</th></tr>
        ${rows}
      </table>
      <p style="color:#71717a;font-size:12px;margin-top:14px">
        Projeção: ~22k produtos ≈ 65-75 MB (~15% do limite). Alerta quando passar de 80%.
      </p>
    </div>`;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DB_DISK_EMAIL ?? process.env.KIT_EMAIL;
  if (!apiKey || !to) {
    console.log("Sem RESEND_API_KEY/KIT_EMAIL — relatório só no stdout:");
    console.log(`Disco: ${pct.toFixed(1)}% (${fmt(dbBytes)} / ${LIMIT_MB} MB)`);
    tables.forEach((t) => console.log(`  ${t.tabela}: ${fmt(t.bytes)}`));
    return;
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Ofertaço Radar <kit@ofertacoradar.com.br>",
      to: to.split(",").map((e) => e.trim()).filter(Boolean),
      subject: `💾 Disco Supabase: ${pct.toFixed(1)}% usado`,
      html,
    }),
  });
  if (!r.ok) {
    console.error("Resend falhou:", r.status, await r.text());
    process.exit(1);
  }
  console.log(`Relatório enviado: ${pct.toFixed(1)}% (${fmt(dbBytes)} / ${LIMIT_MB} MB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { syncPrisma as prisma } from "./db";

// Travas e batimentos de sincronizacao, compartilhados entre as fontes
// (Lomadee, Mercado Livre, Amazon). Um SyncState por fonte guarda
// busyAt (trava) e fase/pagina; linhas auxiliares `${key}:beat` e
// `${key}:err` guardam ultimo sinal de vida e ultimo erro — sem
// migracao de schema.
export const LOCK_STALE_MS = 3 * 60_000; // trava expira se o worker morrer

export async function acquireLock(key: string): Promise<boolean> {
  const locked = await prisma.syncState.updateMany({
    where: {
      key,
      OR: [
        { busyAt: null },
        { busyAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } },
      ],
    },
    data: { busyAt: new Date() },
  });
  return locked.count > 0;
}

export function busyFresh(busyAt: Date | null): boolean {
  return !!busyAt && Date.now() - busyAt.getTime() < LOCK_STALE_MS;
}

const beatKey = (k: string) => `${k}:beat`;
const errKey = (k: string) => `${k}:err`;

export async function beat(key: string) {
  const bk = beatKey(key);
  await prisma.syncState
    .upsert({
      where: { key: bk },
      create: { key: bk, busyAt: new Date() },
      update: { busyAt: new Date() },
    })
    .catch(() => {});
}

export async function noteError(key: string, msg: string) {
  const ek = errKey(key);
  await prisma.syncState
    .upsert({
      where: { key: ek },
      create: { key: ek, phase: msg.slice(0, 200), busyAt: new Date() },
      update: { phase: msg.slice(0, 200), busyAt: new Date() },
    })
    .catch(() => {});
}

export async function clearError(key: string) {
  await prisma.syncState
    .delete({ where: { key: errKey(key) } })
    .catch(() => {});
}

// Heartbeat: mantem busyAt fresco a cada 30s durante TODO o ciclo.
// Sem isso, fases longas sem checkpoint deixam busyAt velho -> alerta
// "travado" falso e trava expira permitindo sync duplicado.
export function startHeartbeat(key: string) {
  const hb = setInterval(() => {
    prisma.syncState
      .update({ where: { key }, data: { busyAt: new Date() } })
      .catch(() => {});
    beat(key);
  }, 30_000);
  hb.unref?.();
  return hb;
}

export async function releaseLock(key: string, hb: ReturnType<typeof setInterval>) {
  clearInterval(hb);
  await prisma.syncState
    .update({ where: { key }, data: { busyAt: null } })
    .catch(() => {});
  // registra o fim do bloco como atividade — o proximo cron retoma
  await beat(key);
}

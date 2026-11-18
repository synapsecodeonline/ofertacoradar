import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  syncPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Cliente dedicado ao sync em background (after()): pool separado para
// nao competir com as queries da pagina pela mesma conexao.
// connection_limit baixo de proposito — sync e sequencial.
const syncUrl = process.env.DATABASE_URL?.replace(
  /connection_limit=\d+/,
  "connection_limit=2",
);
export const syncPrisma =
  globalForPrisma.syncPrisma ??
  new PrismaClient({ datasources: { db: { url: syncUrl } } });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.syncPrisma = syncPrisma;
}

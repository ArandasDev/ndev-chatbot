import { PrismaClient } from '@prisma/client';

// tsx watch recarrega o modulo a cada save; sem o cache global o processo abriria
// um pool novo por reload ate estourar as conexoes do Postgres.
const globalForPrisma = globalThis as unknown as { ndevPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.ndevPrisma ??
  new PrismaClient({
    log: process.env.LOG_LEVEL === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.ndevPrisma = prisma;
}

export async function connectDb(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaNeonHttp(url, {} as any);
  return new PrismaClient({ adapter });
}

export const prisma = global._prisma ?? createPrisma();
if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

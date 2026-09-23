import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDirect?: PrismaClient;
};

function neonDirectUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace("-pooler.", ".");
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function resolveWriteUrl(): string | undefined {
  return process.env.DIRECT_URL?.trim() || neonDirectUrl(process.env.DATABASE_URL);
}

function directClient(): PrismaClient {
  const url = resolveWriteUrl();
  if (!url) return prisma;
  // Interactive $transaction / SAVEPOINT need a Neon session host, not the
  // transaction-mode pooler. Fail here instead of dying mid-request.
  if (url.includes("-pooler.")) {
    throw new Error(
      "[db] writeClient() requires a non-pooler Postgres URL. Set DIRECT_URL to the Neon direct host (not *-pooler.*).",
    );
  }
  if (url === process.env.DATABASE_URL) {
    return prisma;
  }
  globalForPrisma.prismaDirect ??= new PrismaClient({
    datasources: { db: { url } },
  });
  return globalForPrisma.prismaDirect;
}

/**
 * Transaction-safe writer. Always the Neon direct (non-pooler) session when a
 * write URL can be resolved.
 */
export function writeClient(): PrismaClient {
  return directClient();
}

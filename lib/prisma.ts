/**
 * Prisma Client singleton for Next.js.
 *
 * In development, Next.js hot-reloads the module but Node.js keeps the same
 * process, so we store the client on `globalThis` to avoid exhausting the
 * SQLite connection on every reload.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

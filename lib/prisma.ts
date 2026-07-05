/**
 * Prisma Client singleton for Next.js.
 *
 * In development, Next.js hot-reloads the module but Node.js keeps the same
 * process, so we store the client on `globalThis` to avoid exhausting the
 * SQLite connection on every reload.
 *
 * The explicit `PrismaClient` type annotation below ensures VS Code picks up
 * newly generated model types (ParkingCache, DiscordLink) without requiring
 * a manual language server restart.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
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

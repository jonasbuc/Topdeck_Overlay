/**
 * Event store — persists every valid TopDeck webhook event and deduplicates
 * by event.id (the unique identifier provided by TopDeck).
 *
 * TopDeck delivers events at-least-once, so duplicates are expected.
 * We rely on the Prisma `@id` constraint (UNIQUE index on `id`) to detect
 * duplicates; a caught P2002 unique-violation means the event already exists.
 */

import { prisma } from "@/lib/prisma";
import type { TopDeckWebhookEvent } from "@/lib/topdeck/types";

export type StoreResult =
  | { stored: true }
  | { stored: false; reason: "duplicate" | "error"; message?: string };

/**
 * Attempt to persist a webhook event.
 *
 * Returns `{ stored: true }` on success.
 * Returns `{ stored: false, reason: "duplicate" }` if the event.id already
 * exists (idempotent — not an error).
 *
 * Note: `event.tid` is null for ping events (schema allows nullable tid).
 * `event.created` is unix milliseconds — `new Date(ms)` handles it correctly.
 */
export async function storeEvent(
  event: TopDeckWebhookEvent,
  rawPayload: string
): Promise<StoreResult> {
  try {
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        tid: event.tid ?? null,
        type: event.type,
        apiVersion: event.apiVersion,
        createdAt: new Date(event.created), // event.created is unix ms
        rawPayload,
      },
    });

    return { stored: true };
  } catch (err: unknown) {
    // Prisma unique constraint violation code
    if (isPrismaUniqueError(err)) {
      return { stored: false, reason: "duplicate" };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { stored: false, reason: "error", message };
  }
}

/** Retrieve recent events for a tournament, newest first. */
export async function getEventsForTournament(
  tid: string,
  limit = 100
): Promise<Array<{ id: string; type: string; createdAt: Date; rawPayload: string }>> {
  return prisma.webhookEvent.findMany({
    where: { tid },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, createdAt: true, rawPayload: true },
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isPrismaUniqueError(err: unknown): boolean {
  // Prisma error code for unique constraint violations
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

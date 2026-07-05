/**
 * POST /api/webhooks/topdeck
 *
 * Receives signed TopDeck webhook events.
 *
 * Security:
 *  1. Reads raw body (required for signature verification).
 *  2. Verifies HMAC-SHA256 + timestamp tolerance.
 *  3. Responds 200 immediately (TopDeck requires a 2xx within 10 s).
 *  4. Processes the event asynchronously after responding.
 *
 * Idempotency:
 *  - Duplicate events (same event.id) are silently ignored.
 *
 * Realtime:
 *  - After successful processing, publishes new state to SSE subscribers.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyTopDeckSignature } from "@/lib/topdeck/verify-signature";
import { storeEvent } from "@/lib/topdeck/event-store";
import { processEvent } from "@/lib/topdeck/event-processor";
import { enrichTournamentState } from "@/lib/topdeck/enrichment";
import { publish, subscriberCount } from "@/lib/topdeck/sse-publisher";
import { getTournamentState } from "@/lib/topdeck/tournament-state";
import { notify } from "@/lib/discord/notifier";
import type { TopDeckWebhookEvent } from "@/lib/topdeck/types";

// Disable the default Next.js body parser so we can read the raw body
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── 1. Read raw body ────────────────────────────────────────────────────
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ error: "failed to read request body" }, 400);
  }

  // ── 2. Verify signature ─────────────────────────────────────────────────
  const signature = req.headers.get("x-topdeck-signature");
  const result = verifyTopDeckSignature(rawBody, signature, env.TOPDECK_WEBHOOK_SECRET);

  if (!result.ok) {
    console.warn("[webhook] invalid signature:", result.reason);
    return json({ error: "invalid signature", detail: result.reason }, 401);
  }

  // ── 3. Parse envelope ───────────────────────────────────────────────────
  let event: TopDeckWebhookEvent;
  try {
    event = JSON.parse(rawBody) as TopDeckWebhookEvent;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (!event.id || !event.type) {
    return json({ error: "missing event id or type" }, 400);
  }

  // ── 4. Handle ping immediately (no DB write needed) ────────────────────
  if (event.type === "ping") {
    console.info("[webhook] ping received from TopDeck — endpoint is healthy");
    return json({ received: true, type: "ping" }, 200);
  }

  // ── 5. Acknowledge immediately, process async ───────────────────────────
  // We must respond within 10 s. Heavy processing happens after the response.
  //
  // In Next.js App Router we use waitUntil (via the NextResponse after return)
  // by scheduling work with a micro-task. The approach below is compatible
  // with Node.js + edge runtimes without needing a job queue.
  processAsync(event, rawBody);

  return json({ received: true, type: event.type }, 200);
}

// ─── Async processing (runs after response is sent) ─────────────────────────

async function processAsync(event: TopDeckWebhookEvent, rawBody: string) {
  // Non-ping events should always carry a tid; guard defensively.
  if (!event.tid) {
    console.warn(`[webhook] non-ping event with null tid (type=${event.type}) — skipping`);
    return;
  }

  const label = `[webhook:${event.type}] id=${event.id} tid=${event.tid}`;

  // ── Persist + deduplicate ───────────────────────────────────────────────
  const stored = await storeEvent(event, rawBody);

  if (!stored.stored) {
    if (stored.reason === "duplicate") {
      console.info(`${label} — duplicate, skipped`);
      return;
    }
    console.error(`${label} — store error: ${stored.message}`);
    return;
  }

  console.info(`${label} — stored`);

  // ── Enrich with REST API data (first time we see this tournament) ───────
  // Fire-and-forget: enrichment populates startDate, status, location, etc.
  // We check if startDate is already set to avoid redundant REST calls.
  const existingState = await getTournamentState(event.tid!);
  if (!existingState?.startDate) {
    enrichTournamentState(event.tid!).catch((err) =>
      console.warn(`${label} — enrichment error:`, err)
    );
  }

  // ── Process → update tournament state ──────────────────────────────────
  let updatedState;
  try {
    updatedState = await processEvent(event);
  } catch (err) {
    console.error(`${label} — processing failed:`, err);
    return;
  }

  if (!updatedState) {
    console.info(`${label} — no state update produced`);
    return;
  }

  console.info(
    `${label} — state updated, publishing to ${subscriberCount(event.tid!)} subscriber(s)`
  );

  // ── Publish to SSE subscribers ──────────────────────────────────────────
  publish(event.tid!, updatedState);

  // ── Notify Discord (fire-and-forget; errors are swallowed inside notify) ─
  notify(event, updatedState).catch((err) =>
    console.error(`${label} — Discord notifier threw unexpectedly:`, err)
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

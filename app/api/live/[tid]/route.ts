/**
 * GET /api/live/[tid]
 *
 * Server-Sent Events stream for a specific tournament.
 *
 * The client connects once and receives `tournament-state` events whenever
 * the backend processes a new TopDeck webhook for that `tid`.
 *
 * On connect the latest snapshot is sent immediately so the page renders
 * without waiting for the next webhook.
 *
 * SSE event format:
 *   event: tournament-state
 *   data: <JSON-stringified LiveTournamentState>
 *
 * Keepalive:
 *   event: ping
 *   data: {}
 *   (sent every 25 s to prevent proxy timeouts)
 */

import { NextRequest } from "next/server";
import { getTournamentState } from "@/lib/topdeck/tournament-state";
import { subscribe } from "@/lib/topdeck/sse-publisher";
import type { LiveTournamentState } from "@/lib/topdeck/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { tid: string } }
) {
  const { tid } = params;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          );
        } catch {
          // Client disconnected
        }
      };

      // ── Send current snapshot immediately ─────────────────────────────
      const snapshot = await getTournamentState(tid);
      if (snapshot) {
        send("tournament-state", snapshot);
      } else {
        send("tournament-state", null);
      }

      // ── Subscribe to future updates ────────────────────────────────────
      const unsubscribe = subscribe(tid, (state: LiveTournamentState) => {
        send("tournament-state", state);
      });

      // ── Keepalive every 25 s ──────────────────────────────────────────
      const keepalive = setInterval(() => {
        send("ping", {});
      }, 25_000);

      // ── Cleanup when client disconnects ───────────────────────────────
      _req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx: disable buffering
    },
  });
}

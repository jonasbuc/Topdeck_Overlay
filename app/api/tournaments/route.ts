/**
 * GET /api/tournaments
 *
 * Returns a list of tournaments.
 *
 * Strategy:
 *   1. If TOPDECK_API_KEY is set → fetch from the TopDeck REST API
 *      (`/v2/me/tournaments`) and return the organiser's tournaments.
 *   2. Otherwise → list all tournaments known from local webhook events
 *      (DB summaries, newest first).
 *
 * Response:
 *   200 — { tournaments: Array<...>, source: "api" | "db" }
 *   502 — { error: "upstream_error", detail: string }
 */

import { NextResponse } from "next/server";
import { getRestClient, TopDeckApiError } from "@/lib/topdeck/rest-client";
import { listTournamentStates } from "@/lib/topdeck/tournament-state";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = getRestClient(env.TOPDECK_API_KEY ?? null);

  // ── REST API path ──────────────────────────────────────────────────────
  if (client) {
    try {
      const tournaments = await client.getMyTournaments();
      return NextResponse.json({ tournaments, source: "api" });
    } catch (err) {
      if (err instanceof TopDeckApiError) {
        return NextResponse.json(
          { error: "upstream_error", detail: err.message },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "upstream_error", detail: String(err) },
        { status: 502 }
      );
    }
  }

  // ── DB fallback ────────────────────────────────────────────────────────
  const tournaments = await listTournamentStates();
  return NextResponse.json({ tournaments, source: "db" });
}

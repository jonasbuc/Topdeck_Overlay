/**
 * GET /api/tournaments/[tid]/standings
 *
 * Returns standings for a tournament.
 *
 * Strategy:
 *   1. If TOPDECK_API_KEY is set → fetch live standings from TopDeck REST API
 *      and also update the stored state as a side effect.
 *   2. Otherwise → return the standings cached in the local database
 *      (populated by round.ended / tournament.finished webhook events).
 *
 * Query params:
 *   ?round=<n>   — specific round (default: "latest")
 *   ?source=db   — force database-only (skip REST even if key is set)
 *
 * 200  — { standings: TopDeckStanding[], source: "api" | "db" }
 * 404  — { error: "not_found" }  (tournament unknown and no API key)
 * 502  — { error: "upstream_error", detail: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTournamentState, patchTournamentState } from "@/lib/topdeck/tournament-state";
import { getRestClient, TopDeckApiError } from "@/lib/topdeck/rest-client";
import { env } from "@/lib/env";
import type { TopDeckStanding } from "@/lib/topdeck/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const url = new URL(req.url);
  const roundParam = url.searchParams.get("round");
  const forceDb = url.searchParams.get("source") === "db";

  const round =
    roundParam ? (parseInt(roundParam, 10) || "latest") : "latest";

  const client = forceDb ? null : getRestClient(env.TOPDECK_API_KEY ?? null);

  // ── Try REST API first ──────────────────────────────────────────────────
  if (client) {
    let standings: TopDeckStanding[];
    try {
      standings = await client.getStandings(tid, round);
    } catch (err) {
      if (err instanceof TopDeckApiError && err.status === 404) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
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

    // Side-effect: keep our cached state in sync
    await patchTournamentState(tid, { standings }).catch(() => {
      // Non-fatal — state may not exist yet if this is the first request
    });

    return NextResponse.json({ standings, source: "api" });
  }

  // ── Fallback: database-cached standings ────────────────────────────────
  const state = await getTournamentState(tid);
  if (!state) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ standings: state.standings, source: "db" });
}

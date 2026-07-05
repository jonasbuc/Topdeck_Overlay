/**
 * GET /api/tournaments/[tid]
 *
 * Returns the current `LiveTournamentState` for a tournament from the
 * local database. Does NOT call the TopDeck REST API — for streaming live
 * data use the SSE endpoint at /api/live/[tid] instead.
 *
 * 200  — LiveTournamentState (JSON)
 * 404  — { error: "not_found", tid }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTournamentState } from "@/lib/topdeck/tournament-state";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const state = await getTournamentState(tid);

  if (!state) {
    return NextResponse.json(
      { error: "not_found", tid },
      { status: 404 }
    );
  }

  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}

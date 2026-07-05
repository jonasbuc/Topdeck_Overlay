/**
 * POST /api/tournaments/[tid]/resync
 *
 * Forces a REST enrichment of the tournament metadata, bypassing the
 * "recently enriched" guard in enrichTournamentState().
 *
 * Body: (none)
 * Returns: { enriched: boolean; message: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { enrichTournamentState } from "@/lib/topdeck/enrichment";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
): Promise<NextResponse> {
  const { tid } = await params;

  if (!env.TOPDECK_API_KEY) {
    return NextResponse.json(
      { enriched: false, message: "No API key configured" },
      { status: 501 }
    );
  }

  try {
    const enriched = await enrichTournamentState(tid, /* force */ true);
    const message = enriched
      ? "Synced successfully"
      : "Sync skipped (tournament may be complete)";
    return NextResponse.json({ enriched, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ enriched: false, message }, { status: 502 });
  }
}

/**
 * GET /api/tournaments/[tid]/attendees
 *
 * Returns the full attendee list for a tournament fetched from the
 * TopDeck REST API. Requires `TOPDECK_API_KEY` configured with at least
 * judge role for the given tournament.
 *
 * Query params:
 *   ?status=player|dropped|waitlist  — filter by status (default: all)
 *
 * 200  — { attendees: TopDeckAttendee[], count: number }
 * 403  — { error: "forbidden" }         (API key lacks judge role)
 * 501  — { error: "api_key_required" }  (TOPDECK_API_KEY not set)
 * 502  — { error: "upstream_error", detail: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRestClient, TopDeckApiError } from "@/lib/topdeck/rest-client";
import { patchTournamentState } from "@/lib/topdeck/tournament-state";
import { env } from "@/lib/env";
import type { TopDeckAttendee } from "@/lib/topdeck/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as
    | TopDeckAttendee["status"]
    | null;

  const client = getRestClient(env.TOPDECK_API_KEY ?? null);
  if (!client) {
    return NextResponse.json(
      { error: "api_key_required", detail: "Set TOPDECK_API_KEY to use this endpoint" },
      { status: 501 }
    );
  }

  let attendees: TopDeckAttendee[];
  try {
    attendees = await client.getAttendees(tid);
  } catch (err) {
    if (err instanceof TopDeckApiError) {
      if (err.status === 403) {
        return NextResponse.json(
          { error: "forbidden", detail: "API key lacks judge role for this tournament" },
          { status: 403 }
        );
      }
      if (err.status === 404) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
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

  // Side-effect: update waitlist in cached state
  const waitlist = attendees.filter((a) => a.status === "waitlist");
  if (waitlist.length > 0) {
    patchTournamentState(tid, { waitlistPlayers: waitlist }).catch(() => {});
  }

  // Apply optional status filter
  const filtered = statusFilter
    ? attendees.filter((a) => a.status === statusFilter)
    : attendees;

  return NextResponse.json({ attendees: filtered, count: filtered.length });
}

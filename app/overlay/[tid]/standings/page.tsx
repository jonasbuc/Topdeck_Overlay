"use client";

import { useSearchParams } from "next/navigation";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { StandingsStrip } from "@/components/overlays/StandingsStrip";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/standings
 *
 * Query params:
 *   ?rows=<n>    — max rows per page (default 8)
 *
 * Recommended OBS source: 400×900 (side strip)
 * Custom CSS: body { background: transparent; }
 */
export default function StandingsOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  const searchParams = useSearchParams();

  const maxRows = Math.max(
    1,
    parseInt(searchParams.get("rows") ?? "8", 10) || 8
  );

  return (
    <StandingsStrip
      standings={state?.standings ?? []}
      maxRows={maxRows}
    />
  );
}

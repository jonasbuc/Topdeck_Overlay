"use client";

import { useSearchParams } from "next/navigation";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { PairingsOverlay } from "@/components/overlays/PairingsOverlay";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/pairings
 *
 * Compact pairings table overlay.
 * Recommended OBS browser source: 640×900 (or 800×900)
 * Custom CSS: body { background: transparent; }
 *
 * Query params:
 *   ?rows=<n>  — max rows shown (default 20)
 */
export default function PairingsOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  const searchParams = useSearchParams();

  const maxRows = Math.max(
    1,
    parseInt(searchParams.get("rows") ?? "20", 10) || 20
  );

  return (
    <PairingsOverlay
      tables={state?.tables ?? []}
      roundLabel={state?.roundLabel ?? (state?.currentRound ? `Round ${state.currentRound}` : "—")}
      maxRows={maxRows}
    />
  );
}

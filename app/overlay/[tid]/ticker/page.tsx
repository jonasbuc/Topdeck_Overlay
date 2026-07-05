"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { ResultsTicker } from "@/components/overlays/ResultsTicker";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/ticker
 *
 * Horizontally-scrolling results ticker.
 * Recommended OBS source: 1920×64 (bottom bar)
 * Custom CSS: body { background: transparent; }
 */
export default function TickerOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  return <ResultsTicker results={state?.matchResults ?? []} />;
}

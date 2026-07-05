"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { ClockOnly } from "@/components/overlays/ClockOnly";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/clock
 *
 * Pure countdown clock overlay.
 * Recommended OBS source: 600×300 (or any size)
 * Custom CSS: body { background: transparent; }
 */
export default function ClockOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  return <ClockOnly state={state} />;
}

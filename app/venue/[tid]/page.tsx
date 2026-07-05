"use client";

import { useSearchParams } from "next/navigation";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { VenueDisplay } from "@/components/overlays/VenueDisplay";

interface Props {
  params: { tid: string };
}

/**
 * /venue/[tid]
 *
 * Auto-rotating big-screen display for venue projectors and monitors.
 *
 * Cycles through: Clock → Pairings → Standings → Feature Match (if active)
 * Each scene fades in/out over 0.8s. Progress dots shown at the bottom.
 *
 * Query params:
 *   ?duration=<ms>  — scene display duration in ms (default 12000)
 *
 * Setup:
 *   Point a browser (or OBS) at this URL in fullscreen.
 *   The solid dark background makes this suitable for projectors.
 *   No Custom CSS needed (unlike the transparent overlay sources).
 */
export default function VenuePage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);
  const searchParams = useSearchParams();

  const sceneDurationMs = Math.max(
    3000,
    parseInt(searchParams.get("duration") ?? "12000", 10) || 12000
  );

  return <VenueDisplay state={state} sceneDurationMs={sceneDurationMs} />;
}

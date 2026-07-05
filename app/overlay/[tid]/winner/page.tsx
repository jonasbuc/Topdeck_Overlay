"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { WinnerScreen } from "@/components/WinnerScreen";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/winner
 *
 * Winner celebration overlay — shown when the tournament finishes.
 * While the tournament is still running, renders a transparent waiting state.
 *
 * Recommended OBS source: 1920×1080 (fullscreen)
 * Custom CSS: body { background: transparent; }
 *
 * Tip: In OBS, set this source to only be visible in your "Winner" scene,
 * and switch to that scene when the tournament ends.
 */
export default function WinnerOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state } = useTournamentLive(tid);

  if (!state?.finished || !state.winner) {
    return (
      <div className="winner-waiting-overlay">
        Waiting for tournament to finish…
      </div>
    );
  }

  return (
    <WinnerScreen
      winner={state.winner}
      tournamentName={state.name}
      participantCount={state.participantCount}
    />
  );
}

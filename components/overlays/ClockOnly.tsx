/**
 * ClockOnly overlay component.
 *
 * Displays only the round countdown timer — ideal as a standalone
 * OBS browser source (e.g. 400×200 or 600×300).
 * Transparent background inherited from the overlay layout.
 */

"use client";

import { RoundClock } from "@/components/RoundClock";
import type { LiveTournamentState } from "@/lib/topdeck/types";

interface Props {
  state: LiveTournamentState | null;
}

export function ClockOnly({ state }: Props) {
  return (
    <div className="clock-only-root">
      <div className="clock-only-round">
        {state
          ? (state.roundLabel || `Round ${state.currentRound}`)
          : "—"}
      </div>

      <RoundClock
        startedAt={state?.roundStartedAt ?? null}
        roundTimeMinutes={state?.roundTimeMinutes ?? null}
        roundStatus={state?.roundStatus ?? "pending"}
      />

      {state?.name && (
        <div className="clock-only-tournament">{state.name}</div>
      )}
    </div>
  );
}

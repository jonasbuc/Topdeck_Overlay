"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { RoundClock } from "@/components/RoundClock";
import { PairingsTable } from "@/components/PairingsTable";
import { LiveStandings } from "@/components/LiveStandings";
import { WinnerScreen } from "@/components/WinnerScreen";

interface Props {
  params: { tid: string };
}

/**
 * OBS browser-source overlay.
 *
 * Recommended OBS browser source settings:
 *   Width:  1920   Height: 1080
 *   FPS:    30
 *   Custom CSS: body { background: transparent; }
 *   ✅ Shutdown source when not visible
 *   ✅ Refresh browser when scene becomes active
 */
export default function OverlayPage({ params }: Props) {
  const { tid } = params;
  const { state, connected } = useTournamentLive(tid);

  if (state?.finished) {
    return (
      <WinnerScreen
        winner={state.winner}
        tournamentName={state.name}
        participantCount={state.participantCount}
      />
    );
  }

  return (
    <div className="overlay-root">
      {/* Header bar */}
      <div className="overlay-header">
        <span className="overlay-title">
          {state?.name || `Tournament ${tid}`}
        </span>
        <span className="overlay-round">
          {state?.roundLabel || (state?.currentRound ? `Round ${state.currentRound}` : "—")}
        </span>
        <div className="status-bar">
          <div className={`status-dot ${connected ? "connected" : ""}`} />
        </div>
      </div>

      {/* Clock + pairings side-by-side */}
      <div className="overlay-body-grid">
        {/* Round clock panel */}
        <div className="overlay-clock-panel">
          <RoundClock
            startedAt={state?.roundStartedAt ?? null}
            roundTimeMinutes={state?.roundTimeMinutes ?? null}
            roundStatus={state?.roundStatus ?? "pending"}
          />
        </div>

        {/* Pairings panel — compact */}
        {state && (
          <div className="overlay-pairings-panel">
            <PairingsTable
              tables={state.tables.slice(0, 12)}
              roundLabel={state.roundLabel}
            />
          </div>
        )}
      </div>

      {/* Standings strip at the bottom */}
      {state && state.standings.length > 0 && (
        <div className="overlay-standings-strip">
          <LiveStandings standings={state.standings.slice(0, 8)} />
        </div>
      )}
    </div>
  );
}

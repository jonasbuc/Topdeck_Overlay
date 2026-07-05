"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { RoundClock } from "@/components/RoundClock";
import { FeatureMatch } from "@/components/overlays/FeatureMatch";
import { PairingsOverlay } from "@/components/overlays/PairingsOverlay";
import { StandingsStrip } from "@/components/overlays/StandingsStrip";
import { ResultsTicker } from "@/components/overlays/ResultsTicker";
import { WinnerScreen } from "@/components/WinnerScreen";

interface Props {
  params: { tid: string };
}

/**
 * /overlay/[tid]/full
 *
 * Improved 1920×1080 composite overlay.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┬──────────┐
 *   │  [Tournament Name]     [Round N]      [●]   │          │  ← 3.5rem header
 *   ├──────────────────────────────┬──────────────┤ standings │
 *   │  Feature Match               │ Clock        │ strip     │  ← 1fr main
 *   │  Pairings (2-col)            │ (compact)    │           │
 *   ├──────────────────────────────┴──────────────┴──────────┤
 *   │  Results ticker                                         │  ← 4rem
 *   └─────────────────────────────────────────────────────────┘
 *
 * Recommended OBS browser source: 1920×1080
 * Custom CSS: body { background: transparent; }
 */
export default function FullOverlayPage({ params }: Props) {
  const { tid } = params;
  const { state, connected } = useTournamentLive(tid);

  // Show winner screen when finished
  if (state?.finished && state.winner) {
    return (
      <WinnerScreen
        winner={state.winner}
        tournamentName={state.name}
        participantCount={state.participantCount}
      />
    );
  }

  const roundLabel =
    state?.roundLabel ||
    (state?.currentRound ? `Round ${state.currentRound}` : "—");

  // Split pairings into two halves for the 2-col layout
  const regularTables = (state?.tables ?? []).filter((t) => t.table !== "Byes");
  const half = Math.ceil(regularTables.length / 2);
  const leftTables = regularTables.slice(0, half);
  const rightTables = regularTables.slice(half);

  return (
    <div className="full-overlay-root">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="full-overlay-header">
        <span className="full-overlay-title">
          {state?.name ?? `Tournament ${tid}`}
        </span>
        <span className="full-overlay-round">{roundLabel}</span>
        <div className={`full-overlay-status-dot${connected ? " connected" : ""}`} />
      </div>

      {/* ── Main content (left) ──────────────────────────────────────── */}
      <div className="full-overlay-main">
        {/* Feature match */}
        <FeatureMatch state={state} />

        {/* Pairings — two-column split */}
        {regularTables.length > 0 && (
          <div className="pairings-overlay-two-col">
            <PairingsOverlay
              tables={leftTables}
              roundLabel={roundLabel}
              maxRows={10}
            />
            {rightTables.length > 0 && (
              <PairingsOverlay
                tables={rightTables}
                roundLabel={roundLabel}
                maxRows={10}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar (right) ──────────────────────────────────────────── */}
      <div className="full-overlay-sidebar">
        <div className="full-overlay-sidebar-clock">
          <RoundClock
            startedAt={state?.roundStartedAt ?? null}
            roundTimeMinutes={state?.roundTimeMinutes ?? null}
            roundStatus={state?.roundStatus ?? "pending"}
          />
        </div>
        <div className="full-overlay-sidebar-standings">
          <StandingsStrip
            standings={state?.standings ?? []}
            maxRows={12}
            pageIntervalMs={10_000}
          />
        </div>
      </div>

      {/* ── Ticker (bottom) ──────────────────────────────────────────── */}
      <div className="full-overlay-ticker">
        <ResultsTicker results={state?.matchResults ?? []} />
      </div>
    </div>
  );
}

/**
 * FeatureMatch overlay component.
 *
 * Shows one specific match table with large player names.
 * When the match is complete, highlights the winner (or shows "Draw").
 *
 * Suitable as a 1920×300 lower-third or fullscreen source in OBS.
 *
 * Props:
 *   tableNumber — which table to display (1-based). Defaults to the first
 *                 Active table, then the first Pending table, then table 1.
 */

"use client";

import type { LiveTournamentState, TopDeckTable } from "@/lib/topdeck/types";

interface Props {
  state: LiveTournamentState | null;
  tableNumber?: number;
}

/** Pick the best table to feature from the current tables list. */
export function resolveFeatureTable(
  tables: TopDeckTable[],
  preferred?: number
): TopDeckTable | null {
  if (!tables.length) return null;
  const regular = tables.filter((t) => t.table !== "Byes");
  if (!regular.length) return null;

  if (preferred != null) {
    const found = regular.find((t) => t.table === preferred);
    if (found) return found;
  }

  // Auto-select: prefer Active, then Pending, then first
  return (
    regular.find((t) => t.status === "Active") ??
    regular.find((t) => t.status === "Pending") ??
    regular[0]
  );
}

export function FeatureMatch({ state, tableNumber }: Props) {
  if (!state) {
    return (
      <div className="feature-match-root">
        <div className="feature-match-header">
          <span className="feature-match-label">Feature Match</span>
        </div>
        <div className="feature-match-waiting">Waiting for tournament data…</div>
      </div>
    );
  }

  const table = resolveFeatureTable(state.tables, tableNumber);

  if (!table) {
    return (
      <div className="feature-match-root">
        <div className="feature-match-header">
          <span className="feature-match-label">Feature Match</span>
          <span className="feature-match-table-num">
            {state.roundLabel || `Round ${state.currentRound}`}
          </span>
        </div>
        <div className="feature-match-waiting">
          {state.roundStatus === "pending"
            ? "Waiting for pairings…"
            : "No active table found"}
        </div>
      </div>
    );
  }

  const isDraw = table.winner_id === "Draw";
  const isComplete = table.status === "Completed";

  return (
    <div className="feature-match-root">
      <div className="feature-match-header">
        <span className="feature-match-label">Feature Match</span>
        <span className="feature-match-table-num">
          Table {table.table} · {state.roundLabel || `Round ${state.currentRound}`}
        </span>
      </div>

      <div className="feature-match-players">
        {table.players.map((player) => {
          const isWinner = isComplete && !isDraw && table.winner_id === player.id;
          const isInDraw = isComplete && isDraw;

          return (
            <div
              key={player.id}
              className={`feature-match-player ${isWinner ? "winner" : ""} ${isInDraw ? "draw" : ""}`}
            >
              <span className="feature-match-player-name">{player.name}</span>
              {isWinner && (
                <span className="feature-match-result-badge win">Winner</span>
              )}
              {isInDraw && (
                <span className="feature-match-result-badge draw">Draw</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

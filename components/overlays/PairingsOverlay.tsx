/**
 * PairingsOverlay — compact pairings table designed for OBS browser sources.
 *
 * Transparent background (inherited from overlay layout).
 * Suitable as a 640×900 or 800×900 OBS browser source.
 *
 * Color coding:
 *   Active   → accent-tinted row background
 *   Completed → faded out (50% opacity), winner name highlighted green
 *   Pending   → default
 */

"use client";

import type { TopDeckTable } from "@/lib/topdeck/types";

interface Props {
  tables: TopDeckTable[];
  roundLabel: string;
  /** Cap displayed rows to avoid overflow. Default 20. */
  maxRows?: number;
}

export function PairingsOverlay({ tables, roundLabel, maxRows = 20 }: Props) {
  const regular = tables.filter((t) => t.table !== "Byes").slice(0, maxRows);
  const byeRow = tables.find((t) => t.table === "Byes");

  if (!tables.length) {
    return (
      <div className="pairings-overlay-root">
        <div className="pairings-overlay-title">Pairings</div>
        <div className="pairings-overlay-empty">Waiting for pairings…</div>
      </div>
    );
  }

  return (
    <div className="pairings-overlay-root">
      <div className="pairings-overlay-title">
        Pairings — {roundLabel}
      </div>

      {regular.map((t) => {
        const isDraw = t.winner_id === "Draw";
        const isComplete = t.status === "Completed";
        const rowClass =
          t.status === "Active" ? "active"
          : isComplete ? "completed"
          : "";

        return (
          <div
            key={String(t.table)}
            className={`pairings-overlay-row ${rowClass}`}
          >
            <span className="pairings-overlay-tnum">{t.table}</span>

            <div className="pairings-overlay-players">
              {t.players.map((p, i) => {
                const isWinner = isComplete && !isDraw && t.winner_id === p.id;
                return (
                  <span key={p.id}>
                    <span
                      className={`pairings-overlay-player${isWinner ? " is-winner" : ""}`}
                    >
                      {p.name}
                    </span>
                    {i < t.players.length - 1 && (
                      <span className="pairings-overlay-sep">·</span>
                    )}
                  </span>
                );
              })}
            </div>

            <span
              className={`pairings-overlay-result${
                isComplete ? (isDraw ? " draw" : " win") : ""
              }`}
            >
              {isComplete
                ? isDraw
                  ? "Draw"
                  : t.winner ?? "Win"
                : ""}
            </span>
          </div>
        );
      })}

      {byeRow && byeRow.players.length > 0 && (
        <div className="pairings-overlay-row">
          <span className="pairings-overlay-tnum">—</span>
          <div className="pairings-overlay-players">
            <span className="pairings-overlay-player">
              Byes: {byeRow.players.map((p) => p.name).join(", ")}
            </span>
          </div>
          <span className="pairings-overlay-result" />
        </div>
      )}
    </div>
  );
}

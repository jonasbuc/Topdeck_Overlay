/**
 * MatchResultsFeed — shows the latest match results as they come in.
 *
 * Uses real TopDeck API shapes: draw detection via `r.table.winner_id === "Draw"`,
 * winner name via `r.table.winner`, player list via `r.table.players`.
 */

"use client";

import type { MatchResultEntry } from "@/lib/topdeck/types";

interface Props {
  results: MatchResultEntry[];
}

export function MatchResultsFeed({ results }: Props) {
  if (!results.length) {
    return (
      <section className="card">
        <h2 className="section-title">Match Results</h2>
        <p className="empty-state">No results yet.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="section-title">Match Results</h2>
      <ul className="results-feed">
        {results.map((r, idx) => {
          const isDraw = r.table.winner_id === "Draw";
          const playerNames = r.table.players.map((p) => p.name).join(" vs ");

          return (
            <li key={idx} className="result-item">
              <span className="result-meta">
                R{String(r.round)} · T{String(r.tableNumber)}
              </span>
              <span className="result-players">{playerNames}</span>
              <span className={`result-outcome ${isDraw ? "draw" : "win"}`}>
                {isDraw
                  ? "Draw"
                  : r.table.winner
                  ? `${r.table.winner} wins`
                  : "Result set"}
              </span>
              <span className="result-time">
                {new Date(r.reportedAt).toLocaleTimeString()}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

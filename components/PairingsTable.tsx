/**
 * PairingsTable — shows all tables (matches) for the current round.
 *
 * Renamed props: `tables: TopDeckTable[]` replaces old `pairings: TopDeckPairing[]`.
 * Draw detection: `t.winner_id === "Draw"` (not a `result.draw` boolean).
 */

"use client";

import type { TopDeckTable } from "@/lib/topdeck/types";

interface Props {
  tables: TopDeckTable[];
  roundLabel: string;
}

export function PairingsTable({ tables, roundLabel }: Props) {
  // Filter out the special "Byes" row for the main display; show it separately
  const regularTables = tables.filter((t) => t.table !== "Byes");
  const byeRow = tables.find((t) => t.table === "Byes");

  if (!tables.length) {
    return (
      <section className="card">
        <h2 className="section-title">Pairings</h2>
        <p className="empty-state">No pairings yet.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="section-title">Pairings — {roundLabel}</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Players</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {regularTables.map((t) => {
              const isDraw = t.winner_id === "Draw";
              const statusClass =
                t.status === "Completed"
                  ? "completed"
                  : t.status === "Active"
                  ? "active"
                  : "pending";

              return (
                <tr key={String(t.table)} className={statusClass}>
                  <td className="table-num">{t.table}</td>
                  <td>
                    <div className="player-list">
                      {t.players.map((p, i) => (
                        <span key={p.id} className="player-name">
                          {p.name}
                          {i < t.players.length - 1 && (
                            <span className="player-sep"> vs </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="result-cell">
                    {t.status === "Completed" ? (
                      isDraw ? (
                        <span className="result draw">Draw</span>
                      ) : t.winner ? (
                        <span className="result win">{t.winner}</span>
                      ) : (
                        <span className="result pending">—</span>
                      )
                    ) : (
                      <span className="result pending">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {byeRow && byeRow.players.length > 0 && (
        <div className="byes-section">
          <h3 className="byes-title">Byes</h3>
          <ul className="byes-list">
            {byeRow.players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

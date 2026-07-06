/**
 * PairingsTable — shows all tables (matches) for the current round.
 *
 * Renamed props: `tables: TopDeckTable[]` replaces old `pairings: TopDeckPairing[]`.
 * Draw detection: `t.winner_id === "Draw"` (not a `result.draw` boolean).
 */

"use client";

import { useMemo, useState } from "react";
import type { TopDeckTable } from "@/lib/topdeck/types";

interface Props {
  tables: TopDeckTable[];
  roundLabel: string;
}

type StatusFilter = "all" | "active" | "pending" | "completed";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tableStatusKey(table: TopDeckTable): Exclude<StatusFilter, "all"> {
  if (table.status === "Completed") return "completed";
  if (table.status === "Pending") return "pending";
  return "active";
}

function tableResult(table: TopDeckTable): string {
  if (table.status !== "Completed") return "—";
  if (table.winner_id === "Draw") return "Draw";
  return table.winner ?? "Completed";
}

function tableCopyText(table: TopDeckTable): string {
  const players = table.players.map((player) => player.name).join(" vs ");
  return `Table ${String(table.table)}: ${players}`;
}

export function PairingsTable({ tables, roundLabel }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Filter out the special "Byes" row for the main display; show it separately
  const regularTables = tables.filter((t) => t.table !== "Byes");
  const byeRow = tables.find((t) => t.table === "Byes");
  const completedCount = regularTables.filter((t) => t.status === "Completed").length;
  const activeCount = regularTables.filter((t) => t.status === "Active").length;
  const pendingCount = regularTables.filter((t) => t.status === "Pending").length;

  const visibleTables = useMemo(() => {
    const needle = normalize(query);
    return regularTables.filter((table) => {
      if (statusFilter !== "all" && tableStatusKey(table) !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return table.players.some((player) => normalize(player.name).includes(needle));
    });
  }, [query, regularTables, statusFilter]);

  const copyTable = (table: TopDeckTable) => {
    if (!navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    navigator.clipboard
      .writeText(tableCopyText(table))
      .then(() => {
        setCopyMessage(`Copied table ${String(table.table)}`);
        window.setTimeout(() => setCopyMessage(null), 1500);
      })
      .catch(() => {
        setCopyMessage("Copy failed");
        window.setTimeout(() => setCopyMessage(null), 1800);
      });
  };

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
      <div className="pairings-heading-row">
        <h2 className="section-title">Pairings — {roundLabel}</h2>
        <div className="pairings-summary">
          <span>{regularTables.length} tables</span>
          <span>{activeCount} active</span>
          <span>{completedCount} done</span>
        </div>
      </div>

      <div className="pairings-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pairings-search-input"
          placeholder="Player name"
          autoComplete="off"
        />
        <div className="pairings-filter-row">
          {[
            ["all", `All ${regularTables.length}`],
            ["active", `Active ${activeCount}`],
            ["pending", `Pending ${pendingCount}`],
            ["completed", `Done ${completedCount}`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`pairings-filter-btn ${
                statusFilter === key ? "active" : ""
              }`}
              onClick={() => setStatusFilter(key as StatusFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Players</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleTables.map((t) => {
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
                  <td className="pairing-action-cell">
                    <button
                      type="button"
                      className="pairing-copy-btn"
                      onClick={() => copyTable(t)}
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleTables.length === 0 && (
        <p className="empty-state pairings-empty-filter">
          No tables match the current filter.
        </p>
      )}

      {copyMessage && (
        <div className="pairing-copy-message">{copyMessage}</div>
      )}

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

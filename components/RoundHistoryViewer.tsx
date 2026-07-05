/**
 * RoundHistoryViewer — tabbed archive of completed rounds.
 *
 * Shows a tab per completed round. Clicking a tab reveals the pairings
 * (with winner highlighted) and end-of-round standings for that round.
 */

"use client";

import { useState } from "react";
import type { RoundSnapshot } from "@/lib/topdeck/types";

interface Props {
  roundHistory: RoundSnapshot[];
}

function formatLabel(snap: RoundSnapshot): string {
  return /^\d+$/.test(snap.roundLabel)
    ? `Round ${snap.roundLabel}`
    : snap.roundLabel;
}

export function RoundHistoryViewer({ roundHistory }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!roundHistory.length) return null;

  const sorted = [...roundHistory].sort(
    (a, b) => a.stage - b.stage || a.round - b.round
  );

  return (
    <section className="card round-history-card">
      <h2 className="section-title">Round History</h2>

      {/* Tab row */}
      <div className="round-history-tabs">
        {sorted.map((snap, i) => (
          <button
            key={`${snap.stage}-${snap.round}`}
            className={`round-history-tab${openIdx === i ? " active" : ""}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            {formatLabel(snap)}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {openIdx !== null && sorted[openIdx] && (
        <RoundDetail snap={sorted[openIdx]} />
      )}
    </section>
  );
}

function RoundDetail({ snap }: { snap: RoundSnapshot }) {
  const normalTables = snap.tables.filter((t) => t.table !== "Byes");
  const byeTable    = snap.tables.find((t) => t.table === "Byes");

  return (
    <div className="round-history-detail">
      {/* ── Pairings ──────────────────────────────────────────────────── */}
      <div className="round-history-section">
        <h3 className="round-history-subhead">Pairings &amp; Results</h3>
        <div className="rh-tables-grid">
          {normalTables.map((t) => (
            <div
              key={t.table}
              className={`rh-table-card${t.status === "Completed" ? " completed" : ""}`}
            >
              <div className="rh-table-header">
                <span className="rh-table-num">Table {t.table}</span>
                {t.status === "Completed" && (
                  <span className="rh-status-badge">✓</span>
                )}
              </div>
              <ul className="rh-player-list">
                {t.players.map((p) => (
                  <li
                    key={p.id}
                    className={`rh-player${p.id === t.winner_id ? " winner" : ""}`}
                  >
                    {p.id === t.winner_id && (
                      <span className="rh-winner-icon">🏆</span>
                    )}
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {byeTable && byeTable.players.length > 0 && (
            <div className="rh-table-card bye">
              <div className="rh-table-header">
                <span className="rh-table-num">Bye</span>
              </div>
              <ul className="rh-player-list">
                {byeTable.players.map((p) => (
                  <li key={p.id} className="rh-player winner">
                    <span className="rh-winner-icon">↩</span>
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Standings ─────────────────────────────────────────────────── */}
      {snap.standings.length > 0 && (
        <div className="round-history-section">
          <h3 className="round-history-subhead">
            End-of-Round Standings
            <span className="rh-standings-count">
              {snap.standings.length} players
            </span>
          </h3>
          <div className="rh-standings-cols">
            {/* Left half */}
            <ol className="rh-standings-list">
              {snap.standings
                .slice(0, Math.ceil(snap.standings.length / 2))
                .map((s) => (
                  <li key={s.id} className={`rh-standing-row${s.standing <= 3 ? " top3" : ""}`}>
                    <span className="rh-pos">{s.standing}.</span>
                    <span className="rh-name">{s.name}</span>
                    <span className="rh-pts">{s.points} pts</span>
                    <span className="rh-wr">{(s.winRate * 100).toFixed(0)}%</span>
                  </li>
                ))}
            </ol>
            {/* Right half */}
            <ol className="rh-standings-list" start={Math.ceil(snap.standings.length / 2) + 1}>
              {snap.standings
                .slice(Math.ceil(snap.standings.length / 2))
                .map((s) => (
                  <li key={s.id} className="rh-standing-row">
                    <span className="rh-pos">{s.standing}.</span>
                    <span className="rh-name">{s.name}</span>
                    <span className="rh-pts">{s.points} pts</span>
                    <span className="rh-wr">{(s.winRate * 100).toFixed(0)}%</span>
                  </li>
                ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

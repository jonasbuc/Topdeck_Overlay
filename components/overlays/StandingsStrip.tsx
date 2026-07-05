/**
 * StandingsStrip overlay component.
 *
 * Compact vertical standings list. When there are more entries than
 * `maxRows`, the list auto-paginates every `pageIntervalMs` milliseconds.
 * Suitable as a 400×900 OBS side strip.
 */

"use client";

import { useEffect, useState } from "react";
import type { TopDeckStanding } from "@/lib/topdeck/types";

interface Props {
  standings: TopDeckStanding[];
  maxRows?: number;
  pageIntervalMs?: number;
}

export function StandingsStrip({
  standings,
  maxRows = 8,
  pageIntervalMs = 8000,
}: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(standings.length / maxRows));

  // Auto-paginate if the list is longer than maxRows
  useEffect(() => {
    if (standings.length <= maxRows) return;
    const id = setInterval(
      () => setPage((p) => (p + 1) % totalPages),
      pageIntervalMs
    );
    return () => clearInterval(id);
  }, [standings.length, maxRows, totalPages, pageIntervalMs]);

  if (!standings.length) {
    return (
      <div className="standings-strip-root">
        <div className="standings-strip-title">Standings</div>
        <div className="standings-strip-empty">Pending first round end…</div>
      </div>
    );
  }

  const start = page * maxRows;
  const shown = standings.slice(start, start + maxRows);

  return (
    <div className="standings-strip-root">
      <div className="standings-strip-title">
        <span>Standings</span>
        {totalPages > 1 && (
          <span className="standings-strip-page">{page + 1}/{totalPages}</span>
        )}
      </div>
      {shown.map((s) => (
        <div
          key={s.id}
          className={`standings-strip-row ${s.standing === 1 ? "rank-first" : ""}`}
        >
          <span className="standings-strip-rank">
            {s.standing === 1 ? "👑" : s.standing}
          </span>
          <span className="standings-strip-name">{s.name}</span>
          <span className="standings-strip-pts">{s.points}</span>
          <span className="standings-strip-wr">
            {((s.successRate ?? s.winRate) * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

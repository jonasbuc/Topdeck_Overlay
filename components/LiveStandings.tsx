/**
 * LiveStandings — ranked table of current standings.
 *
 * Uses real TopDeck API shapes: `s.standing` (not `s.rank`), `s.name`
 * (not `s.player.name`), `s.winRate` (not `s.omwp`).
 * No wins/losses/draws columns — TopDeck standings only provide points + rates.
 */

"use client";

import type { TopDeckStanding } from "@/lib/topdeck/types";

interface Props {
  standings: TopDeckStanding[];
}

export function LiveStandings({ standings }: Props) {
  if (!standings.length) {
    return (
      <section className="card">
        <h2 className="section-title">Standings</h2>
        <p className="empty-state">Standings will appear after round 1 ends.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="section-title">Standings</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Pts</th>
              <th title="Win Rate">Win%</th>
              <th title="Opponent Win Rate">OWin%</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr
                key={s.id}
                className={s.standing === 1 ? "rank-first" : ""}
              >
                <td className="rank">
                  {s.standing === 1 && <span className="crown">👑 </span>}
                  {s.standing}
                </td>
                <td className="player-name">{s.name}</td>
                <td className="pts">{s.points}</td>
                <td className="win-rate">
                  {`${((s.successRate ?? s.winRate) * 100).toFixed(1)}%`}
                </td>
                <td className="omwp">
                  {`${((s.opponentSuccessRate ?? s.opponentWinRate) * 100).toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

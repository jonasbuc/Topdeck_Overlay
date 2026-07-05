/**
 * PlayerRoster — full list of registered players.
 *
 * `droppedPlayers` is now `DroppedPlayerEntry[]` (not `string[]`), so we
 * build a Set<string> of dropped player IDs for O(1) lookup.
 */

"use client";

import type { TopDeckPlayer, DroppedPlayerEntry } from "@/lib/topdeck/types";

interface Props {
  players: TopDeckPlayer[];
  droppedPlayers: DroppedPlayerEntry[];
}

export function PlayerRoster({ players, droppedPlayers }: Props) {
  if (!players.length) {
    return (
      <section className="card">
        <h2 className="section-title">Player Roster</h2>
        <p className="empty-state">No players registered yet.</p>
      </section>
    );
  }

  const droppedIds = new Set(droppedPlayers.map((d) => d.player.id));

  return (
    <section className="card">
      <h2 className="section-title">
        Player Roster{" "}
        <span className="count-badge">{players.length}</span>
      </h2>
      <ul className="roster-list">
        {players.map((p) => {
          const dropped = droppedIds.has(p.id);
          const dropEntry = dropped
            ? droppedPlayers.find((d) => d.player.id === p.id)
            : undefined;

          return (
            <li key={p.id} className={`roster-item ${dropped ? "dropped" : ""}`}>
              <span className="player-name">{p.name}</span>
              {dropped && (
                <span className="dropped-badge">
                  dropped{dropEntry ? ` (R${dropEntry.droppedInRound})` : ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

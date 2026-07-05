/**
 * DroppedPlayers — list of players who have dropped from the tournament.
 *
 * Uses `DroppedPlayerEntry[]` (not `string[]`), displaying player name and
 * the round in which they dropped.
 */

"use client";

import type { DroppedPlayerEntry } from "@/lib/topdeck/types";

interface Props {
  droppedPlayers: DroppedPlayerEntry[];
}

export function DroppedPlayers({ droppedPlayers }: Props) {
  if (!droppedPlayers.length) return null;

  return (
    <section className="card">
      <h2 className="section-title">
        Dropped Players{" "}
        <span className="count-badge">{droppedPlayers.length}</span>
      </h2>
      <ul className="dropped-list">
        {droppedPlayers.map(({ player, droppedInRound }) => (
          <li key={player.id} className="dropped-item">
            <span className="player-name">{player.name}</span>
            <span className="drop-round">after R{droppedInRound}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

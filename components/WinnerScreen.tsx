/**
 * WinnerScreen — celebratory banner shown when a tournament finishes.
 *
 * `winner` is now `TopDeckPlayer | null` (not `string | null`).
 */

"use client";

import Link from "next/link";
import type { TopDeckPlayer } from "@/lib/topdeck/types";

interface Props {
  winner: TopDeckPlayer | null;
  tournamentName: string;
  participantCount: number | null;
  /** When provided, shows an analytics button. */
  tid?: string;
}

export function WinnerScreen({ winner, tournamentName, participantCount, tid }: Props) {
  if (!winner) return null;

  return (
    <div className="winner-screen">
      <div className="winner-content">
        <p className="winner-label">🏆 Tournament Champion</p>
        <h1 className="winner-name">{winner.name}</h1>
        <p className="winner-tournament">{tournamentName}</p>
        {participantCount != null && (
          <p className="winner-count">{participantCount} players</p>
        )}
        {tid && (
          <Link href={`/analytics/${tid}`} className="winner-analytics-btn">
            View Full Stats &amp; Results →
          </Link>
        )}
      </div>
    </div>
  );
}

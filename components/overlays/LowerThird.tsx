/**
 * LowerThird overlay component.
 *
 * A 1920×120-style horizontal standings bar for use as a lower-third OBS
 * browser source (set source dimensions to 1920×120 in OBS).
 *
 * Layout: [STANDINGS label] [rank · name · pts] [rank · name · pts] …
 *
 * Shows the top `maxEntries` standings. Extra entries are truncated since
 * a lower-third has limited horizontal space.
 */

"use client";

import type { TopDeckStanding } from "@/lib/topdeck/types";

interface Props {
  standings: TopDeckStanding[];
  /** How many standings entries to show. Default 8. */
  maxEntries?: number;
}

export function LowerThird({ standings, maxEntries = 8 }: Props) {
  const shown = standings.slice(0, maxEntries);

  return (
    <div className="lower-third-root">
      <div className="lower-third-label">Standings</div>

      <div className="lower-third-entries">
        {shown.length === 0 ? (
          <span className="lower-third-empty">Pending first round end…</span>
        ) : (
          shown.map((s) => (
            <div key={s.id} className="lower-third-entry">
              <span className="lower-third-rank">
                {s.standing === 1 ? "👑" : s.standing}
              </span>
              <span className="lower-third-name">{s.name}</span>
              <span className="lower-third-pts">
                {s.points}pt
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

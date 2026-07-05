/**
 * ResultsTicker overlay component.
 *
 * Horizontally-scrolling results feed. New results prepend to the left
 * and the whole strip auto-scrolls right-to-left via `requestAnimationFrame`.
 * Suitable as a 1920×64 bottom-bar OBS source.
 */

"use client";

import { useEffect, useRef } from "react";
import type { MatchResultEntry } from "@/lib/topdeck/types";

interface Props {
  results: MatchResultEntry[];
  /** Scroll speed in pixels per second. Default 60. */
  speed?: number;
}

export function ResultsTicker({ results, speed = 60 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

  // Reset scroll position when results change
  useEffect(() => {
    posRef.current = 0;
    if (trackRef.current) trackRef.current.style.transform = "translateX(0px)";
  }, [results.length]);

  useEffect(() => {
    if (!results.length) return;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current == null) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const track = trackRef.current;
      if (track) {
        posRef.current -= speed * delta;
        // Reset when the whole track has scrolled off-screen
        if (posRef.current < -(track.scrollWidth)) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [results, speed]);

  if (!results.length) {
    return (
      <div className="ticker-root">
        <span className="ticker-label">Results</span>
      <span className="ticker-empty">No results yet</span>
      </div>
    );
  }

  return (
    <div className="ticker-root">
      <span className="ticker-label">Results</span>
      <div className="ticker-track-wrapper">
        <div className="ticker-track" ref={trackRef}>
          {results.map((r, i) => {
            const isDraw = r.table.winner_id === "Draw";
            return (
              <span key={`${r.stage}-${r.round}-${r.tableNumber}-${i}`} className="ticker-item">
                <span className="ticker-meta">R{String(r.round)} T{String(r.tableNumber)}</span>
                <span className="ticker-players">
                  {r.table.players.map((p) => p.name).join(" · ")}
                </span>
                <span className={isDraw ? "ticker-draw" : "ticker-win"}>
                  {isDraw ? "Draw" : `${r.table.winner ?? "?"} wins`}
                </span>
                {i < results.length - 1 && <span className="ticker-sep">·</span>}
              </span>
            );
          })}
          {/* Duplicate for seamless loop */}
          {results.map((r, i) => {
            const isDraw = r.table.winner_id === "Draw";
            return (
              <span key={`dup-${r.stage}-${r.round}-${r.tableNumber}-${i}`} className="ticker-item">
                <span className="ticker-meta">R{String(r.round)} T{String(r.tableNumber)}</span>
                <span className="ticker-players">
                  {r.table.players.map((p) => p.name).join(" · ")}
                </span>
                <span className={isDraw ? "ticker-draw" : "ticker-win"}>
                  {isDraw ? "Draw" : `${r.table.winner ?? "?"} wins`}
                </span>
                {i < results.length - 1 && <span className="ticker-sep">·</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

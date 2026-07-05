/**
 * RoundClock — live countdown timer for the current round.
 *
 * Counts down from `roundTimeMinutes` starting at `startedAt` (unix ms).
 * Shows "Time!" in red when time expires.
 */

"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Unix milliseconds when the round started. null = timer not set. */
  startedAt: number | null;
  /** Configured round length in minutes. null = no timer. */
  roundTimeMinutes: number | null;
  roundStatus: string;
}

export function RoundClock({ startedAt, roundTimeMinutes, roundStatus }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  // overtime = ms past the end of the round (positive when time is up)
  const [overtime, setOvertime] = useState<number>(0);

  useEffect(() => {
    if (!startedAt || roundTimeMinutes == null || roundStatus !== "active") {
      setRemaining(null);
      setOvertime(0);
      return;
    }

    const roundLengthMs = roundTimeMinutes * 60 * 1000;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const left = roundLengthMs - elapsed;
      if (left >= 0) {
        setRemaining(left);
        setOvertime(0);
      } else {
        setRemaining(0);
        setOvertime(Math.abs(left));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, roundTimeMinutes, roundStatus]);

  if (roundStatus === "ended") {
    return (
      <div className="round-clock ended">
        <span className="clock-label">Round ended</span>
      </div>
    );
  }

  if (roundStatus === "pending" || remaining === null) {
    return (
      <div className="round-clock pending">
        <span className="clock-label">Waiting for round to start…</span>
      </div>
    );
  }

  const isOvertime = remaining === 0 && overtime > 0;
  const totalSecs = isOvertime
    ? Math.floor(overtime / 1000)
    : Math.floor((remaining ?? 0) / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className={`round-clock ${isOvertime ? "overtime" : "active"}`}>
      <span className="clock-time">
        {isOvertime ? `+${display}` : display}
      </span>
      <span className="clock-label">
        {isOvertime ? "overtime" : "remaining"}
      </span>
    </div>
  );
}

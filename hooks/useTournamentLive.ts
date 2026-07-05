/**
 * useTournamentLive
 *
 * React hook that subscribes to the SSE stream for a tournament and keeps a
 * `LiveTournamentState` in local state.
 *
 * - On mount: fetches the REST snapshot (fast initial render).
 * - Then: opens an SSE connection and applies streaming updates.
 * - On unmount: closes the SSE connection.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import type { LiveTournamentState } from "@/lib/topdeck/types";

export function useTournamentLive(tid: string) {
  const [state, setState] = useState<LiveTournamentState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!tid) return;

    let cancelled = false;

    // ── Fetch initial snapshot ────────────────────────────────────────────
    fetch(`/api/tournaments/${tid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LiveTournamentState | null) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => {/* SSE will still work */});

    // ── Open SSE stream ────────────────────────────────────────────────────
    const es = new EventSource(`/api/live/${tid}`);
    esRef.current = es;

    es.addEventListener("tournament-state", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LiveTournamentState | null;
        if (!cancelled && data) {
          setState(data);
          setConnected(true);
          setError(null);
        }
      } catch {
        // malformed JSON — ignore
      }
    });

    es.addEventListener("ping", () => {
      setConnected(true);
    });

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost. Reconnecting…");
    };

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
    };
  }, [tid]);

  return { state, connected, error };
}

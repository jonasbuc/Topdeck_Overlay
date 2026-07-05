"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import {
  computeTournamentAnalytics,
  computeRoundByRoundPerformance,
  type PlayerStat,
  type SeatStat,
  type RoundByRoundData,
  type RoundResult,
} from "@/lib/topdeck/analytics";
import type { LiveTournamentState } from "@/lib/topdeck/types";

interface Props {
  params: { tid: string };
}

// ─── DynamicBar ───────────────────────────────────────────────────────────────
// Sets --fill-pct CSS custom property via ref so we avoid inline styles.

function DynamicBar({ value, className }: { value: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.style.setProperty("--fill-pct", value.toFixed(4));
  }, [value]);
  return <div ref={ref} className={className} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoundProgressCard({ state }: { state: LiveTournamentState }) {
  const { roundProgress, roundDuration, totalRoundsPlayed } = computeTournamentAnalytics(state);
  const pct = roundProgress.completionRate ?? 0;
  const overtime = roundDuration.remainingMs != null && roundDuration.remainingMs < 0;

  return (
    <div className="analytics-card">
      <h2>Round Progress</h2>
      <div className="progress-bar">
        <DynamicBar value={pct} className="progress-fill" />
      </div>
      <div className="progress-labels">
        <span>{Math.round(pct * 100)}% complete</span>
        <span>
          {roundProgress.completed}/{roundProgress.total} tables done
        </span>
      </div>
      <table className="stats-table stats-table-spaced">
        <tbody>
          <tr>
            <td>Active</td>
            <td>{roundProgress.active}</td>
          </tr>
          <tr>
            <td>Pending</td>
            <td>{roundProgress.pending}</td>
          </tr>
          <tr>
            <td>Rounds played</td>
            <td>{totalRoundsPlayed}</td>
          </tr>
          {roundDuration.totalMs != null && roundDuration.remainingMs != null && (
            <tr>
              <td>Time remaining</td>
              <td className={overtime ? "overtime" : ""}>
                {formatMs(Math.abs(roundDuration.remainingMs))}
                {overtime ? " overtime" : ""}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SeatStatsCard({ seatStats }: { seatStats: SeatStat[] }) {
  if (seatStats.length === 0) {
    return (
      <div className="analytics-card">
        <h2>Seat Advantage</h2>
        <p className="text-muted">No completed matches yet.</p>
      </div>
    );
  }

  const maxWinRate = Math.max(...seatStats.map((s) => s.winRate ?? 0), 0.01);

  return (
    <div className="analytics-card">
      <h2>Seat Advantage</h2>
      {seatStats.map((s) => (
        <div key={s.seat} className="stat-bar-row">
          <span className="stat-bar-label">Seat {s.seat + 1}</span>
          <div className="stat-bar-track">
            <DynamicBar
              value={(s.winRate ?? 0) / maxWinRate}
              className="stat-bar-fill"
            />
          </div>
          <span className="stat-bar-value">
            {s.winRate != null ? `${Math.round(s.winRate * 100)}%` : "—"}
          </span>
        </div>
      ))}
      <p className="seat-hint">
        Win rate per seat position across {seatStats[0]?.total ?? 0}+ completed matches.
      </p>
    </div>
  );
}

function DrawRateCard({ state }: { state: LiveTournamentState }) {
  const { drawRate, totalMatchesRecorded } = computeTournamentAnalytics(state);

  return (
    <div className="analytics-card">
      <h2>Match Summary</h2>
      <table className="stats-table">
        <tbody>
          <tr>
            <td>Matches recorded</td>
            <td>{totalMatchesRecorded}</td>
          </tr>
          <tr>
            <td>Draw rate</td>
            <td>
              {drawRate != null ? `${Math.round(drawRate * 100)}%` : "—"}
            </td>
          </tr>
          <tr>
            <td>Participants</td>
            <td>{state.participantCount ?? "—"}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>{state.status}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsCard({ playerStats }: { playerStats: PlayerStat[] }) {
  if (playerStats.length === 0) {
    return (
      <div className="analytics-card-wide">
        <h2>Player Stats</h2>
        <p className="text-muted">No completed matches yet.</p>
      </div>
    );
  }

  return (
    <div className="analytics-card-wide">
      <h2>Player Stats</h2>
      <div className="overflow-x-auto">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>W</th>
              <th>L</th>
              <th>D</th>
              <th>Win%</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((p, i) => (
              <tr key={p.id}>
                <td className="text-muted">{p.standing ?? i + 1}</td>
                <td>{p.name}</td>
                <td>{p.wins}</td>
                <td>{p.losses}</td>
                <td>{p.draws}</td>
                <td>{Math.round(p.winRate * 100)}%</td>
                <td className="text-muted">{p.points ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface EventRow {
  id: string;
  tid: string | null;
  type: string;
  apiVersion: string;
  createdAt: string;
  receivedAt: string;
}

function EventsLog({ tid }: { tid: string }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || events !== null) return;
    fetch(`/api/tournaments/${tid}/events`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EventRow[]) => setEvents(data))
      .catch(() => setEvents([]));
  }, [open, tid, events]);

  return (
    <div className="admin-panel">
      <h2>Raw Event Log</h2>
      <button
        className="events-show-btn"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide" : "Show"} events
      </button>
      {open && (
        <div className="events-log">
          {events === null ? (
            <p className="text-muted">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-muted">No events found.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="event-log-row">
                <span className="event-log-time">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
                <span className="event-log-type">{e.type}</span>
                <span className="event-id">
                  {e.id.slice(0, 16)}…
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminPanel({ tid }: { tid: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleResync() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/resync`, { method: "POST" });
      const data = (await res.json()) as { enriched: boolean; message: string };
      setStatus(data.message);
    } catch {
      setStatus("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-panel">
      <h2>Admin</h2>
      <div className="admin-row">
        <button
          className="resync-btn"
          onClick={handleResync}
          disabled={loading}
        >
          {loading ? "Syncing…" : "↺ Force Resync"}
        </button>
        {status && <span className="admin-status-msg">{status}</span>}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── FinalResultsCard ─────────────────────────────────────────────────────────

function FinalResultsCard({ state }: { state: LiveTournamentState }) {
  if (!state.finished && !state.standings.length) return null;
  const top = state.standings.slice(0, 8);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="analytics-card-wide">
      <h2>Final Results</h2>
      <div className="final-results-grid">
        {top.map((s) => (
          <div key={s.id} className={`final-result-row${s.standing <= 3 ? " podium" : ""}`}>
            <span className="final-result-pos">
              {medals[s.standing - 1] ?? s.standing}
            </span>
            <span className="final-result-name">{s.name}</span>
            <span className="final-result-pts">{s.points} pts</span>
            <span className="final-result-wr">{(s.winRate * 100).toFixed(0)}% WR</span>
            <span className="final-result-owr">{(s.opponentWinRate * 100).toFixed(0)}% OWR</span>
          </div>
        ))}
      </div>
      {state.standings.length > 8 && (
        <p className="final-results-more">
          +{state.standings.length - 8} more players in standings
        </p>
      )}
    </div>
  );
}

// ─── RoundByRoundCard ─────────────────────────────────────────────────────────

const RESULT_LABEL: Record<NonNullable<RoundResult>, string> = {
  win:  "W", loss: "L", draw: "D", bye: "↩",
};
const RESULT_CLASS: Record<NonNullable<RoundResult>, string> = {
  win:  "rbr-win", loss: "rbr-loss", draw: "rbr-draw", bye: "rbr-bye",
};

function RoundByRoundCard({ data }: { data: RoundByRoundData }) {
  if (!data.columns.length || !data.rows.length) return null;

  return (
    <div className="analytics-card-wide">
      <h2>Round-by-Round Performance</h2>
      <div className="overflow-x-auto">
        <table className="rbr-table">
          <thead>
            <tr>
              <th className="rbr-th-pos">#</th>
              <th className="rbr-th-name">Player</th>
              {data.columns.map((col) => (
                <th key={col.key} className="rbr-th-round">{col.label}</th>
              ))}
              <th className="rbr-th-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.player.id}>
                <td className="rbr-td-pos">{row.finalStanding ?? "—"}</td>
                <td className="rbr-td-name">{row.player.name}</td>
                {row.results.map((result, i) => (
                  <td key={data.columns[i].key} className="rbr-td-result">
                    {result ? (
                      <span className={`rbr-badge ${RESULT_CLASS[result]}`}>
                        {RESULT_LABEL[result]}
                      </span>
                    ) : (
                      <span className="rbr-absent">·</span>
                    )}
                  </td>
                ))}
                <td className="rbr-td-pts">{row.finalPoints ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rbr-legend">
        <span className="rbr-badge rbr-win">W</span> Win ·&nbsp;
        <span className="rbr-badge rbr-loss">L</span> Loss ·&nbsp;
        <span className="rbr-badge rbr-draw">D</span> Draw ·&nbsp;
        <span className="rbr-badge rbr-bye">↩</span> Bye ·&nbsp;
        <span className="rbr-absent">·</span> Not in bracket
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage({ params }: Props) {
  const { tid } = params;
  const { state, connected, error } = useTournamentLive(tid);

  const analytics = state ? computeTournamentAnalytics(state) : null;
  const rbrData = state
    ? computeRoundByRoundPerformance(
        state.matchResults,
        state.roundHistory ?? [],
        state.players,
        state.standings
      )
    : null;

  const statusClass = state?.finished
    ? "status-complete"
    : state?.status === "Ongoing"
    ? "status-ongoing"
    : "status-pending";

  return (
    <div className="analytics-page-bg page-bg">
      <div className="analytics-page">
        {/* Header */}
        <div className="analytics-header">
          <div className="analytics-header-row">
            <h1>{state?.name ?? `Tournament ${tid}`}</h1>
            <span className={`status-badge ${statusClass}`}>
              {state?.status ?? "Loading…"}
            </span>
            {connected && !state?.finished && (
              <span className="analytics-live-dot">● Live</span>
            )}
          </div>
          <div className="analytics-header-links">
            <Link href={`/dashboard/${tid}`} className="btn-secondary">
              ← Dashboard
            </Link>
            <Link href="/tournaments" className="btn-secondary">
              All Tournaments
            </Link>
          </div>
          {error && <p className="analytics-error-msg">{error}</p>}
        </div>

        {/* Loading state */}
        {!state && <p className="text-muted">Loading tournament data…</p>}

        {/* Finished tournament banner */}
        {state?.finished && state.winner && (
          <div className="tournament-complete-banner">
            <span className="tcb-trophy">🏆</span>
            <div>
              <div className="tcb-label">Tournament Champion</div>
              <div className="tcb-name">{state.winner.name}</div>
            </div>
            <div className="tcb-meta">
              {state.participantCount} players · {(rbrData?.columns.length ?? 0)} rounds
            </div>
          </div>
        )}

        {/* Stat cards grid */}
        {state && analytics && (
          <>
            {/* Final results first for finished tournaments */}
            {state.finished && <FinalResultsCard state={state} />}

            {/* Round-by-round performance matrix */}
            {rbrData && rbrData.columns.length > 0 && (
              <RoundByRoundCard data={rbrData} />
            )}

            <div className="analytics-grid">
              {!state.finished && <RoundProgressCard state={state} />}
              <SeatStatsCard seatStats={analytics.seatStats} />
              <DrawRateCard state={state} />
            </div>

            <PlayerStatsCard playerStats={analytics.playerStats} />
            <AdminPanel tid={tid} />
            <EventsLog tid={tid} />
          </>
        )}
      </div>
    </div>
  );
}

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

function CutWatchCard({ state }: { state: LiveTournamentState }) {
  if (state.standings.length === 0) {
    return (
      <div className="analytics-card">
        <h2>Cut Watch</h2>
        <p className="text-muted">Standings will appear after the first completed round.</p>
      </div>
    );
  }

  const cutSize = state.standings.length >= 16 ? 16 : Math.min(8, state.standings.length);
  const cutoff = state.standings[cutSize - 1];
  const bubble = cutoff
    ? state.standings
        .filter((entry) => Math.abs(entry.points - cutoff.points) <= 3)
        .slice(0, 10)
    : [];

  return (
    <div className="analytics-card">
      <h2>Cut Watch</h2>
      <div className="cut-watch-hero">
        <span>Projected cut</span>
        <strong>Top {cutSize}</strong>
        <p>
          {cutoff
            ? `${cutoff.points} points at #${cutSize}`
            : "Waiting for standings"}
        </p>
      </div>
      <div className="cut-watch-list">
        {bubble.map((entry) => (
          <div key={entry.id}>
            <span>#{entry.standing}</span>
            <strong>{entry.name}</strong>
            <small>{entry.points} pts</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function collectCommanderNames(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectCommanderNames(item, depth + 1));
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const hits: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("commander") || lowered === "partner") {
      hits.push(...collectCommanderNames(child, depth + 1));
    } else if (depth < 2) {
      hits.push(...collectCommanderNames(child, depth + 1));
    }
  }
  return hits;
}

function MetagameDashboardCard({ state }: { state: LiveTournamentState }) {
  const archetypes = new Map<string, { count: number; points: number; topCut: number }>();
  const cutSize = state.standings.length >= 16 ? 16 : Math.min(8, state.standings.length);

  for (const standing of state.standings) {
    const commanders = collectCommanderNames(standing.deckObj)
      .map((name) => name.trim())
      .filter(Boolean);
    const label = commanders.length > 0 ? commanders.slice(0, 2).join(" / ") : "Unknown deck";
    const entry = archetypes.get(label) ?? { count: 0, points: 0, topCut: 0 };
    entry.count += 1;
    entry.points += standing.points;
    entry.topCut += standing.standing <= cutSize ? 1 : 0;
    archetypes.set(label, entry);
  }

  const rows = [...archetypes.entries()]
    .map(([name, stats]) => ({
      name,
      ...stats,
      averagePoints: stats.count > 0 ? stats.points / stats.count : 0,
    }))
    .sort((a, b) => b.count - a.count || b.averagePoints - a.averagePoints)
    .slice(0, 8);

  return (
    <div className="analytics-card">
      <h2>Metagame</h2>
      {rows.length === 0 ? (
        <p className="text-muted">Deck data is not available yet.</p>
      ) : (
        <div className="meta-breakdown-list">
          {rows.map((row) => (
            <div key={row.name}>
              <strong>{row.name}</strong>
              <span>{row.count} players</span>
              <small>
                {row.averagePoints.toFixed(1)} avg pts · {row.topCut} in projected cut
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BubblePredictorCard({ state }: { state: LiveTournamentState }) {
  if (state.standings.length === 0) return null;
  const cutSize = state.standings.length >= 16 ? 16 : Math.min(8, state.standings.length);
  const cutoff = state.standings[cutSize - 1];
  const bubble = cutoff
    ? state.standings.filter((entry) => Math.abs(entry.points - cutoff.points) <= 3)
    : [];

  return (
    <div className="analytics-card">
      <h2>Bubble Predictor</h2>
      <div className="bubble-summary">
        <span>Cut line</span>
        <strong>{cutoff ? `${cutoff.points} pts` : "-"}</strong>
        <p>Players within one match of Top {cutSize}</p>
      </div>
      <div className="bubble-player-list">
        {bubble.slice(0, 8).map((entry) => {
          const risk =
            entry.standing <= cutSize && entry.points === cutoff?.points
              ? "breakers risk"
              : entry.standing > cutSize && entry.points + 3 >= (cutoff?.points ?? 0)
              ? "win-and-in"
              : "near cut";
          return (
            <div key={entry.id}>
              <span>#{entry.standing}</span>
              <strong>{entry.name}</strong>
              <small>{entry.points} pts · {risk}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoundQualityMonitorCard({ state }: { state: LiveTournamentState }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const activeTables = state.tables.filter((table) => table.status === "Active");
  const pendingTables = state.tables.filter((table) => table.status === "Pending");
  const completedTables = state.tables.filter((table) => table.status === "Completed");
  const draws = completedTables.filter((table) => table.winner_id === "Draw").length;
  const drawRate =
    completedTables.length > 0 ? Math.round((draws / completedTables.length) * 100) : null;
  const overtime =
    now != null &&
    state.roundStartedAt != null &&
    state.roundTimeMinutes != null &&
    now > state.roundStartedAt + state.roundTimeMinutes * 60_000;

  return (
    <div className="analytics-card">
      <h2>Round Quality</h2>
      <div className="quality-grid">
        <div>
          <span>Active</span>
          <strong>{activeTables.length}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{pendingTables.length}</strong>
        </div>
        <div>
          <span>Draw rate</span>
          <strong>{drawRate == null ? "-" : `${drawRate}%`}</strong>
        </div>
        <div>
          <span>Clock</span>
          <strong>{overtime ? "Overtime" : state.roundStatus}</strong>
        </div>
      </div>
      {activeTables.length > 0 && (
        <p className="text-muted">
          Watch tables {activeTables.slice(0, 6).map((table) => table.table).join(", ")}
          {activeTables.length > 6 ? " and more" : ""}.
        </p>
      )}
    </div>
  );
}

function PlayerJourneyView({ data }: { data: RoundByRoundData }) {
  const [selectedId, setSelectedId] = useState(data.rows[0]?.player.id ?? "");
  if (!data.rows.length) return null;
  const selected = data.rows.find((row) => row.player.id === selectedId) ?? data.rows[0];

  return (
    <div className="analytics-card-wide">
      <h2>Player Journey</h2>
      <select
        className="journey-select"
        aria-label="Select player for journey view"
        value={selected.player.id}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {data.rows.map((row) => (
          <option key={row.player.id} value={row.player.id}>
            {row.finalStanding ? `#${row.finalStanding} ` : ""}
            {row.player.name}
          </option>
        ))}
      </select>
      <div className="journey-strip">
        {data.columns.map((column, index) => {
          const result = selected.results[index];
          return (
            <div key={column.key} className={result ? RESULT_CLASS[result] : ""}>
              <span>{column.label}</span>
              <strong>{result ? RESULT_LABEL[result] : "-"}</strong>
            </div>
          );
        })}
      </div>
      <p className="text-muted">
        Final: {selected.finalStanding ? `#${selected.finalStanding}` : "-"} ·{" "}
        {selected.finalPoints ?? "-"} points
      </p>
    </div>
  );
}

function PostEventReportCard({
  state,
  tid,
}: {
  state: LiveTournamentState;
  tid: string;
}) {
  const winner = state.winner?.name ?? state.standings[0]?.name ?? "Winner pending";
  const topDeck = collectCommanderNames(state.standings[0]?.deckObj).slice(0, 2).join(" / ");
  const reportText = `${state.name || "Tournament"} finished with ${winner} on top${
    topDeck ? ` piloting ${topDeck}` : ""
  }. ${state.participantCount ?? state.players.length} players competed across ${
    state.roundHistory.length || state.currentRound || "multiple"
  } rounds.`;

  return (
    <div className="analytics-card-wide report-generator-card">
      <h2>Post-event Report</h2>
      <p>{reportText}</p>
      <Link href={`/recap/${tid}`} className="btn-secondary">
        Open shareable recap
      </Link>
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

            {rbrData && rbrData.columns.length > 0 && (
              <PlayerJourneyView data={rbrData} />
            )}

            <div className="analytics-grid">
              {!state.finished && <RoundProgressCard state={state} />}
              <CutWatchCard state={state} />
              <BubblePredictorCard state={state} />
              <MetagameDashboardCard state={state} />
              <RoundQualityMonitorCard state={state} />
              <SeatStatsCard seatStats={analytics.seatStats} />
              <DrawRateCard state={state} />
            </div>

            {state.finished && <PostEventReportCard state={state} tid={tid} />}
            <PlayerStatsCard playerStats={analytics.playerStats} />
            <AdminPanel tid={tid} />
            <EventsLog tid={tid} />
          </>
        )}
      </div>
    </div>
  );
}

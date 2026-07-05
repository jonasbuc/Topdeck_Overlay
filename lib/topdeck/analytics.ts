/**
 * Analytics service.
 *
 * Pure functions that derive statistics from live tournament state.
 * No I/O, no side effects — easy to test and safe to call in any context.
 *
 * All functions accept data already deserialized from LiveTournamentState,
 * so they work both server-side (from DB) and client-side (from SSE state).
 */

import type {
  MatchResultEntry,
  TopDeckStanding,
  TopDeckTable,
  LiveTournamentState,
  RoundSnapshot,
  TopDeckPlayer,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerStat {
  id: string;
  name: string;
  /** Wins derived from MatchResultEntry.table.winner_id */
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  /** wins / gamesPlayed, or 0 if no games played */
  winRate: number;
  /** Points from standings (null if not in standings) */
  points: number | null;
  /** Rank from standings (null if not in standings) */
  standing: number | null;
}

export interface SeatStat {
  /** 0-based seat index within the players array */
  seat: number;
  wins: number;
  total: number;
  /** wins / total, or null if total === 0 */
  winRate: number | null;
}

export interface RoundProgress {
  total: number;
  completed: number;
  active: number;
  pending: number;
  /** 0–1, derived from completed / total. null if no tables. */
  completionRate: number | null;
}

export interface RoundDuration {
  /** Unix ms the round started, or null. */
  startedAt: number | null;
  /** Current elapsed time in ms, or null if not started. */
  elapsedMs: number | null;
  /** Configured duration in ms, or null. */
  totalMs: number | null;
  /** Remaining time in ms. Negative means overtime. null if not started. */
  remainingMs: number | null;
}

export interface TournamentAnalytics {
  playerStats: PlayerStat[];
  seatStats: SeatStat[];
  roundProgress: RoundProgress;
  roundDuration: RoundDuration;
  totalRoundsPlayed: number;
  totalMatchesRecorded: number;
  drawRate: number | null;
}

// ─── computePlayerStats ───────────────────────────────────────────────────────

/**
 * Builds per-player win/loss/draw totals from match results.
 * Merges with standings to include points and rank.
 *
 * Only counts Completed tables. Resets (result="reset") are excluded because
 * they arrive with table=null in the MatchResultEntry.
 */
export function computePlayerStats(
  matchResults: MatchResultEntry[],
  standings: TopDeckStanding[]
): PlayerStat[] {
  const statsMap = new Map<string, Omit<PlayerStat, "points" | "standing">>();

  // Build a lookup of standing data
  const standingMap = new Map(standings.map((s) => [s.id, s]));

  for (const result of matchResults) {
    const { table } = result;
    if (table.status !== "Completed") continue;

    const isDraw = table.winner_id === "Draw";

    for (const player of table.players) {
      if (!statsMap.has(player.id)) {
        statsMap.set(player.id, {
          id: player.id,
          name: player.name,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0,
          winRate: 0,
        });
      }

      const stat = statsMap.get(player.id)!;
      stat.gamesPlayed++;

      if (isDraw) {
        stat.draws++;
      } else if (table.winner_id === player.id) {
        stat.wins++;
      } else {
        stat.losses++;
      }
    }
  }

  // Compute win rates and merge standings
  const result: PlayerStat[] = [];
  for (const [id, stat] of statsMap) {
    const standing = standingMap.get(id);
    result.push({
      ...stat,
      winRate: stat.gamesPlayed > 0 ? stat.wins / stat.gamesPlayed : 0,
      points: standing?.points ?? null,
      standing: standing?.standing ?? null,
    });
  }

  // Also include players who are in standings but have no match results
  for (const s of standings) {
    if (!statsMap.has(s.id)) {
      result.push({
        id: s.id,
        name: s.name,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
        winRate: 0,
        points: s.points,
        standing: s.standing,
      });
    }
  }

  // Sort by wins desc, then standing asc (nulls last)
  return result.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.standing != null && b.standing != null) return a.standing - b.standing;
    if (a.standing != null) return -1;
    if (b.standing != null) return 1;
    return 0;
  });
}

// ─── computeSeatStats ─────────────────────────────────────────────────────────

/**
 * Computes win rates broken down by seat position (index within players[]).
 *
 * In a 4-player pod each seat index 0–3 corresponds to a different "seat".
 * Only Completed tables with a non-draw winner are counted.
 */
export function computeSeatStats(matchResults: MatchResultEntry[]): SeatStat[] {
  // Determine the max seat count from the data
  let maxSeats = 0;
  for (const r of matchResults) {
    if (r.table.status === "Completed") {
      maxSeats = Math.max(maxSeats, r.table.players.length);
    }
  }

  if (maxSeats === 0) return [];

  const seats: SeatStat[] = Array.from({ length: maxSeats }, (_, i) => ({
    seat: i,
    wins: 0,
    total: 0,
    winRate: null,
  }));

  for (const result of matchResults) {
    const { table } = result;
    if (table.status !== "Completed") continue;
    if (table.winner_id === "Draw") continue; // draws don't count for seat bias

    for (let i = 0; i < table.players.length; i++) {
      if (i >= maxSeats) break;
      seats[i].total++;
      if (table.players[i].id === table.winner_id) {
        seats[i].wins++;
      }
    }
  }

  return seats.map((s) => ({
    ...s,
    winRate: s.total > 0 ? s.wins / s.total : null,
  }));
}

// ─── computeRoundProgress ────────────────────────────────────────────────────

/**
 * Returns completion statistics for the current tables list.
 * Excludes the "Byes" row from the totals.
 */
export function computeRoundProgress(tables: TopDeckTable[]): RoundProgress {
  const regular = tables.filter((t) => t.table !== "Byes");
  const total = regular.length;

  if (total === 0) {
    return { total: 0, completed: 0, active: 0, pending: 0, completionRate: null };
  }

  let completed = 0;
  let active = 0;
  let pending = 0;

  for (const t of regular) {
    if (t.status === "Completed") completed++;
    else if (t.status === "Active") active++;
    else pending++; // "Pending" or "Bye"
  }

  return {
    total,
    completed,
    active,
    pending,
    completionRate: completed / total,
  };
}

// ─── computeRoundDuration ────────────────────────────────────────────────────

/**
 * Computes timing information for the current round.
 * Pass `nowMs = Date.now()` for live calculations.
 */
export function computeRoundDuration(
  state: Pick<LiveTournamentState, "roundStartedAt" | "roundTimeMinutes" | "roundStatus">,
  nowMs = Date.now()
): RoundDuration {
  const { roundStartedAt, roundTimeMinutes } = state;

  if (!roundStartedAt) {
    return { startedAt: null, elapsedMs: null, totalMs: null, remainingMs: null };
  }

  const totalMs = roundTimeMinutes != null ? roundTimeMinutes * 60 * 1000 : null;
  const elapsedMs = nowMs - roundStartedAt;
  const remainingMs = totalMs != null ? totalMs - elapsedMs : null;

  return { startedAt: roundStartedAt, elapsedMs, totalMs, remainingMs };
}

// ─── computeTournamentAnalytics ───────────────────────────────────────────────

/**
 * Convenience wrapper — computes all analytics for a tournament state at once.
 */
export function computeTournamentAnalytics(
  state: LiveTournamentState,
  nowMs = Date.now()
): TournamentAnalytics {
  const playerStats = computePlayerStats(state.matchResults, state.standings);
  const seatStats = computeSeatStats(state.matchResults);
  const roundProgress = computeRoundProgress(state.tables);
  const roundDuration = computeRoundDuration(state, nowMs);

  const completedMatches = state.matchResults.filter(
    (r) => r.table.status === "Completed"
  );
  const draws = completedMatches.filter((r) => r.table.winner_id === "Draw");
  const drawRate =
    completedMatches.length > 0 ? draws.length / completedMatches.length : null;

  // Unique rounds that have produced completed match results
  const roundsSeen = new Set(
    state.matchResults
      .filter((r) => r.table.status === "Completed")
      .map((r) => `${r.stage}-${r.round}`)
  );

  return {
    playerStats,
    seatStats,
    roundProgress,
    roundDuration,
    totalRoundsPlayed: roundsSeen.size,
    totalMatchesRecorded: state.matchResults.length,
    drawRate,
  };
}

// ─── computeRoundByRoundPerformance ──────────────────────────────────────────

export type RoundResult = "win" | "loss" | "draw" | "bye" | null;

export interface RoundColumn {
  key: string;       // e.g. "1-1", "2-1"
  label: string;     // e.g. "Round 1", "Top 16"
  stage: number;
  round: number | string;
}

export interface PlayerRoundRow {
  player: TopDeckPlayer;
  finalStanding: number | null;
  finalPoints: number | null;
  results: RoundResult[];   // indexed parallel to columns
  totalWins: number;
}

export interface RoundByRoundData {
  columns: RoundColumn[];
  rows: PlayerRoundRow[];
}

/**
 * Builds a player × round matrix from match results and round history.
 * Players are sorted by final standing.
 */
export function computeRoundByRoundPerformance(
  matchResults: MatchResultEntry[],
  roundHistory: RoundSnapshot[],
  players: TopDeckPlayer[],
  standings: TopDeckStanding[]
): RoundByRoundData {
  if (!roundHistory.length) return { columns: [], rows: [] };

  // Build ordered round columns from history
  const sorted = [...roundHistory].sort(
    (a, b) => a.stage - b.stage || String(a.round).localeCompare(String(b.round), undefined, { numeric: true })
  );
  const columns: RoundColumn[] = sorted.map((snap) => ({
    key: `${snap.stage}-${snap.round}`,
    label: /^\d+$/.test(snap.roundLabel) ? `R${snap.roundLabel}` : snap.roundLabel,
    stage: snap.stage,
    round: snap.round,
  }));

  // Collect all known players (union of registered players + anyone in standings)
  const allPlayersMap = new Map<string, TopDeckPlayer>();
  for (const p of players) allPlayersMap.set(p.id, p);
  for (const s of standings) {
    if (!allPlayersMap.has(s.id)) allPlayersMap.set(s.id, { id: s.id, name: s.name });
  }

  const standingMap = new Map(standings.map((s) => [s.id, s]));

  // For each player, derive their result in each round column
  const rows: PlayerRoundRow[] = [];
  for (const player of allPlayersMap.values()) {
    const results: RoundResult[] = columns.map((col) => {
      // Find match result entries for this stage+round
      const roundEntries = matchResults.filter(
        (r) =>
          r.stage === col.stage &&
          String(r.round) === String(col.round) &&
          r.table.status === "Completed"
      );
      for (const entry of roundEntries) {
        const inTable = entry.table.players.some((p) => p.id === player.id);
        if (!inTable) continue;
        if (entry.table.winner_id === "Draw") return "draw";
        if (entry.table.winner_id === player.id) return "win";
        return "loss";
      }
      // Not in any completed result — check if it was a bye round
      const snap = sorted.find((s) => s.stage === col.stage && String(s.round) === String(col.round));
      if (snap) {
        const byeTable = snap.tables.find((t) => t.table === "Byes");
        if (byeTable?.players.some((p) => p.id === player.id)) return "bye";
      }
      return null; // absent (bracket round they weren't seeded into)
    });

    const totalWins = results.filter((r) => r === "win" || r === "bye").length;
    const s = standingMap.get(player.id);

    rows.push({
      player,
      finalStanding: s?.standing ?? null,
      finalPoints: s?.points ?? null,
      results,
      totalWins,
    });
  }

  // Sort by final standing (nulls last), then by total wins
  rows.sort((a, b) => {
    if (a.finalStanding !== null && b.finalStanding !== null)
      return a.finalStanding - b.finalStanding;
    if (a.finalStanding !== null) return -1;
    if (b.finalStanding !== null) return 1;
    return b.totalWins - a.totalWins;
  });

  return { columns, rows };
}

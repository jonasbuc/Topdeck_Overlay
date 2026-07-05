/**
 * Tests for lib/topdeck/analytics.ts
 *
 * All functions are pure — no mocking required.
 */

import { describe, it, expect } from "vitest";
import {
  computePlayerStats,
  computeSeatStats,
  computeRoundProgress,
  computeRoundDuration,
  computeTournamentAnalytics,
} from "@/lib/topdeck/analytics";
import type { MatchResultEntry, TopDeckStanding, TopDeckTable } from "@/lib/topdeck/types";
import type { LiveTournamentState } from "@/lib/topdeck/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTable(
  overrides: Partial<TopDeckTable> & { tableNum?: number | "Byes" }
): TopDeckTable {
  const { tableNum = 1, ...rest } = overrides;
  return {
    table: tableNum,
    players: [],
    winner: null,
    winner_id: null,
    winner_games: null,
    loser_games: null,
    status: "Pending",
    ...rest,
  };
}

function makeResult(
  override: Partial<MatchResultEntry> & {
    tableOverride?: Partial<TopDeckTable>;
  } = {}
): MatchResultEntry {
  const { tableOverride, ...rest } = override;
  return {
    stage: 1,
    round: 1,
    tableNumber: 1,
    result: "winner",
    reportedAt: Date.now(),
    table: makeTable(tableOverride ?? {}),
    ...rest,
  };
}

function makeStanding(id: string, standing: number, points: number): TopDeckStanding {
  return {
    id,
    name: `Player ${id}`,
    standing,
    points,
    winRate: 0,
    opponentWinRate: 0,
  };
}

function makeMinimalState(
  overrides: Partial<LiveTournamentState> = {}
): LiveTournamentState {
  return {
    tid: "tid_test",
    name: "Test",
    game: "MTG",
    format: "Commander",
    roundStatus: "pending",
    currentRound: 0,
    currentStage: 0,
    roundLabel: "Round 0",
    roundStartedAt: null,
    roundTimeMinutes: null,
    tables: [],
    matchResults: [],
    standings: [],
    players: [],
    droppedPlayers: [],
    waitlistPlayers: [],
    roundHistory: [],
    participantCount: null,
    winner: null,
    finished: false,
    startDate: null,
    status: "Not Started",
    location: null,
    headerImage: null,
    finishedAt: null,
    checkinStarted: false,
    checkinStage: null,
    lastEventId: "",
    lastEventCreated: 0,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── computePlayerStats ───────────────────────────────────────────────────────

describe("computePlayerStats", () => {
  it("returns empty array for no input", () => {
    expect(computePlayerStats([], [])).toEqual([]);
  });

  it("counts a win correctly", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [{ id: "p1", name: "Alice" }],
        winner_id: "p1",
      },
    });
    const stats = computePlayerStats([result], []);
    expect(stats).toHaveLength(1);
    expect(stats[0].id).toBe("p1");
    expect(stats[0].wins).toBe(1);
    expect(stats[0].losses).toBe(0);
    expect(stats[0].draws).toBe(0);
    expect(stats[0].winRate).toBe(1);
  });

  it("counts a loss correctly", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "p1",
      },
    });
    const stats = computePlayerStats([result], []);
    const bob = stats.find((s) => s.id === "p2")!;
    expect(bob.losses).toBe(1);
    expect(bob.wins).toBe(0);
    expect(bob.winRate).toBe(0);
  });

  it("counts a draw correctly", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "Draw",
      },
    });
    const stats = computePlayerStats([result], []);
    for (const s of stats) {
      expect(s.draws).toBe(1);
      expect(s.wins).toBe(0);
      expect(s.losses).toBe(0);
    }
  });

  it("skips non-Completed tables", () => {
    const result = makeResult({
      tableOverride: {
        status: "Active",
        players: [{ id: "p1", name: "Alice" }],
        winner_id: null,
      },
    });
    const stats = computePlayerStats([result], []);
    expect(stats).toHaveLength(0);
  });

  it("merges standings data into player stats", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [{ id: "p1", name: "Alice" }],
        winner_id: "p1",
      },
    });
    const standing = makeStanding("p1", 1, 9);
    const stats = computePlayerStats([result], [standing]);
    expect(stats[0].points).toBe(9);
    expect(stats[0].standing).toBe(1);
  });

  it("includes standings-only players with zero games", () => {
    const standing = makeStanding("p_new", 1, 3);
    const stats = computePlayerStats([], [standing]);
    expect(stats).toHaveLength(1);
    expect(stats[0].gamesPlayed).toBe(0);
    expect(stats[0].winRate).toBe(0);
  });

  it("accumulates multiple rounds for the same player", () => {
    const mkResult = (round: number, winnerId: string) =>
      makeResult({
        round,
        tableOverride: {
          status: "Completed",
          players: [
            { id: "p1", name: "Alice" },
            { id: "p2", name: "Bob" },
          ],
          winner_id: winnerId,
        },
      });

    const stats = computePlayerStats([mkResult(1, "p1"), mkResult(2, "p2"), mkResult(3, "p1")], []);
    const alice = stats.find((s) => s.id === "p1")!;
    expect(alice.wins).toBe(2);
    expect(alice.losses).toBe(1);
    expect(alice.gamesPlayed).toBe(3);
    expect(alice.winRate).toBeCloseTo(2 / 3);
  });
});

// ─── computeSeatStats ─────────────────────────────────────────────────────────

describe("computeSeatStats", () => {
  it("returns empty array for no results", () => {
    expect(computeSeatStats([])).toEqual([]);
  });

  it("counts seat 0 win correctly", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "p1",
      },
    });
    const seats = computeSeatStats([result]);
    expect(seats[0].wins).toBe(1);
    expect(seats[0].total).toBe(1);
    expect(seats[1].wins).toBe(0);
    expect(seats[1].total).toBe(1);
  });

  it("counts seat 1 win correctly", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "p2",
      },
    });
    const seats = computeSeatStats([result]);
    expect(seats[0].wins).toBe(0);
    expect(seats[1].wins).toBe(1);
  });

  it("excludes draws from seat stats", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "Draw",
      },
    });
    const seats = computeSeatStats([result]);
    // totals should be 0 since draws are excluded
    expect(seats.every((s) => s.total === 0)).toBe(true);
  });

  it("computes winRate as null for zero total", () => {
    const result = makeResult({
      tableOverride: {
        status: "Completed",
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
        winner_id: "Draw",
      },
    });
    const seats = computeSeatStats([result]);
    expect(seats.every((s) => s.winRate === null)).toBe(true);
  });
});

// ─── computeRoundProgress ────────────────────────────────────────────────────

describe("computeRoundProgress", () => {
  it("returns null completionRate for empty tables", () => {
    expect(computeRoundProgress([])).toEqual({
      total: 0,
      completed: 0,
      active: 0,
      pending: 0,
      completionRate: null,
    });
  });

  it("excludes the Byes row from totals", () => {
    const tables = [
      makeTable({ tableNum: 1, status: "Completed" }),
      makeTable({ tableNum: "Byes", status: "Bye" }),
    ];
    const progress = computeRoundProgress(tables);
    expect(progress.total).toBe(1);
    expect(progress.completed).toBe(1);
    expect(progress.completionRate).toBe(1);
  });

  it("correctly categorises active and pending tables", () => {
    const tables = [
      makeTable({ tableNum: 1, status: "Completed" }),
      makeTable({ tableNum: 2, status: "Active" }),
      makeTable({ tableNum: 3, status: "Pending" }),
    ];
    const progress = computeRoundProgress(tables);
    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(1);
    expect(progress.active).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.completionRate).toBeCloseTo(1 / 3);
  });

  it("returns 1 when all tables completed", () => {
    const tables = [
      makeTable({ tableNum: 1, status: "Completed" }),
      makeTable({ tableNum: 2, status: "Completed" }),
    ];
    expect(computeRoundProgress(tables).completionRate).toBe(1);
  });
});

// ─── computeRoundDuration ────────────────────────────────────────────────────

describe("computeRoundDuration", () => {
  it("returns all-null when roundStartedAt is null", () => {
    const state = makeMinimalState({ roundStartedAt: null });
    expect(computeRoundDuration(state)).toEqual({
      startedAt: null,
      elapsedMs: null,
      totalMs: null,
      remainingMs: null,
    });
  });

  it("computes elapsedMs and remainingMs correctly", () => {
    const start = 1_000_000;
    const now = start + 10_000; // 10 seconds later
    const state = makeMinimalState({
      roundStartedAt: start,
      roundTimeMinutes: 50,
    });
    const result = computeRoundDuration(state, now);
    expect(result.startedAt).toBe(start);
    expect(result.elapsedMs).toBe(10_000);
    expect(result.totalMs).toBe(50 * 60 * 1000);
    expect(result.remainingMs).toBe(50 * 60 * 1000 - 10_000);
  });

  it("returns negative remainingMs when time has expired", () => {
    const start = 1_000_000;
    const totalMs = 50 * 60 * 1000;
    const now = start + totalMs + 5_000; // 5s overtime
    const state = makeMinimalState({
      roundStartedAt: start,
      roundTimeMinutes: 50,
    });
    const { remainingMs } = computeRoundDuration(state, now);
    expect(remainingMs).toBe(-5_000);
  });

  it("returns null remainingMs when no roundTimeMinutes set", () => {
    const state = makeMinimalState({
      roundStartedAt: 1_000_000,
      roundTimeMinutes: null,
    });
    const { remainingMs, totalMs } = computeRoundDuration(state, 1_010_000);
    expect(totalMs).toBeNull();
    expect(remainingMs).toBeNull();
  });
});

// ─── computeTournamentAnalytics ───────────────────────────────────────────────

describe("computeTournamentAnalytics", () => {
  it("handles completely empty state", () => {
    const state = makeMinimalState();
    const analytics = computeTournamentAnalytics(state);
    expect(analytics.playerStats).toEqual([]);
    expect(analytics.seatStats).toEqual([]);
    expect(analytics.roundProgress.total).toBe(0);
    expect(analytics.drawRate).toBeNull();
    expect(analytics.totalMatchesRecorded).toBe(0);
  });

  it("computes drawRate correctly", () => {
    const mkResult = (round: number, isDraw: boolean) =>
      makeResult({
        round,
        tableOverride: {
          status: "Completed",
          players: [
            { id: "p1", name: "Alice" },
            { id: "p2", name: "Bob" },
          ],
          winner_id: isDraw ? "Draw" : "p1",
        },
      });

    const state = makeMinimalState({
      matchResults: [mkResult(1, false), mkResult(2, true), mkResult(3, false)],
    });
    const analytics = computeTournamentAnalytics(state);
    expect(analytics.drawRate).toBeCloseTo(1 / 3);
  });

  it("counts unique rounds played", () => {
    const mk = (stage: number, round: number) =>
      makeResult({
        stage,
        round,
        tableOverride: {
          status: "Completed",
          players: [{ id: "p1", name: "Alice" }],
          winner_id: "p1",
        },
      });

    const state = makeMinimalState({
      // 2 tables in round 1, 1 table in round 2
      matchResults: [mk(1, 1), mk(1, 1), mk(1, 2)],
    });
    const analytics = computeTournamentAnalytics(state);
    expect(analytics.totalRoundsPlayed).toBe(2);
    expect(analytics.totalMatchesRecorded).toBe(3);
  });
});

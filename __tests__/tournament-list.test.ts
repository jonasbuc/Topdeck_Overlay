/**
 * Tests for:
 *   - lib/topdeck/tournament-state.ts → listTournamentStates()
 *   - components/overlays/FeatureMatch.tsx → resolveFeatureTable()
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tournamentState: {
      findMany: mockFindMany,
    },
  },
}));

const { listTournamentStates } = await import("@/lib/topdeck/tournament-state");

// ─── listTournamentStates ─────────────────────────────────────────────────────

describe("listTournamentStates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty array when there are no rows", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await listTournamentStates();
    expect(result).toEqual([]);
  });

  it("returns correctly mapped summaries", async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      {
        tid: "tid_001",
        name: "Test Tournament",
        game: "Magic: The Gathering",
        format: "cEDH",
        status: "Ongoing",
        startDate: "1751500800000",
        participantCount: 32,
        finished: false,
        updatedAt: now,
      },
    ]);

    const result = await listTournamentStates();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tid: "tid_001",
      name: "Test Tournament",
      game: "Magic: The Gathering",
      format: "cEDH",
      status: "Ongoing",
      startDate: 1751500800000, // parsed from string
      participantCount: 32,
      finished: false,
      updatedAt: now.toISOString(),
    });
  });

  it("converts null startDate to null (not 0)", async () => {
    mockFindMany.mockResolvedValue([
      {
        tid: "tid_002",
        name: "Unknown Start",
        game: "Flesh and Blood",
        format: "Classic Constructed",
        status: "Not Started",
        startDate: null,
        participantCount: null,
        finished: false,
        updatedAt: new Date(),
      },
    ]);

    const result = await listTournamentStates();
    expect(result[0].startDate).toBeNull();
    expect(result[0].participantCount).toBeNull();
  });

  it("passes limit to Prisma findMany", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTournamentStates(10);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it("orders by updatedAt desc", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTournamentStates();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: "desc" } })
    );
  });
});

// ─── resolveFeatureTable ──────────────────────────────────────────────────────

import { resolveFeatureTable } from "@/components/overlays/FeatureMatch";
import type { TopDeckTable } from "@/lib/topdeck/types";

function makeTable(
  tableNum: number,
  status: TopDeckTable["status"]
): TopDeckTable {
  return {
    table: tableNum,
    players: [
      { id: `p${tableNum}a`, name: `Player A (T${tableNum})` },
      { id: `p${tableNum}b`, name: `Player B (T${tableNum})` },
    ],
    winner: null,
    winner_id: null,
    winner_games: null,
    loser_games: null,
    status,
  };
}

describe("resolveFeatureTable", () => {
  it("returns null for empty tables list", () => {
    expect(resolveFeatureTable([])).toBeNull();
  });

  it("returns null if only Byes exist", () => {
    const byes: TopDeckTable = {
      table: "Byes",
      players: [{ id: "p1", name: "Alice" }],
      winner: "Alice",
      winner_id: "p1",
      winner_games: null,
      loser_games: null,
      status: "Bye",
    };
    expect(resolveFeatureTable([byes])).toBeNull();
  });

  it("returns the preferred table when it exists", () => {
    const tables = [makeTable(1, "Pending"), makeTable(2, "Active"), makeTable(3, "Pending")];
    const result = resolveFeatureTable(tables, 3);
    expect(result?.table).toBe(3);
  });

  it("falls back to auto-select when preferred table not found", () => {
    const tables = [makeTable(1, "Active"), makeTable(2, "Pending")];
    const result = resolveFeatureTable(tables, 99);
    // Should auto-select the Active table
    expect(result?.table).toBe(1);
  });

  it("auto-selects Active table over Pending", () => {
    const tables = [makeTable(1, "Pending"), makeTable(2, "Active"), makeTable(3, "Pending")];
    const result = resolveFeatureTable(tables);
    expect(result?.table).toBe(2);
  });

  it("auto-selects first Pending if no Active tables", () => {
    const tables = [makeTable(1, "Pending"), makeTable(2, "Pending")];
    const result = resolveFeatureTable(tables);
    expect(result?.table).toBe(1);
  });

  it("auto-selects first table if all are Completed", () => {
    const tables = [makeTable(1, "Completed"), makeTable(2, "Completed")];
    const result = resolveFeatureTable(tables);
    expect(result?.table).toBe(1);
  });
});

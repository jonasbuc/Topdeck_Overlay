import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock tournament-state ───────────────────────────────────────────────────

const mockGetState = vi.fn();
const mockPatchState = vi.fn();
vi.mock("@/lib/topdeck/tournament-state", () => ({
  getTournamentState: mockGetState,
  patchTournamentState: mockPatchState,
}));

const { processEvent } = await import("@/lib/topdeck/event-processor");

import type {
  TopDeckPingEvent,
  TopDeckRoundPublishedEvent,
  TopDeckRoundStartedEvent,
  TopDeckTournamentFinished,
  TopDeckPlayerRegistered,
  TopDeckPlayerDropped,
  DroppedPlayerEntry,
} from "@/lib/topdeck/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Fixed unix-ms timestamp — real TopDeck uses ms, NOT ISO strings
const NOW = 1751500800000;
const TID = "tid_001";

function base(overrides: Partial<TopDeckPingEvent> = {}): TopDeckPingEvent {
  return {
    id: "evt_001",
    tid: TID,
    apiVersion: "2026-07",
    created: NOW, // unix ms
    type: "ping",
    tournament: { name: "Test", game: "MTG", format: "cEDH" },
    data: { message: "hi" },
    ...overrides,
  };
}

function withType<T>(type: string, data: unknown): T {
  return { ...base(), type, data } as T;
}

// ─── ping ─────────────────────────────────────────────────────────────────────

describe("processEvent – ping", () => {
  it("returns null for ping events without touching state", async () => {
    const result = await processEvent(base());
    expect(result).toBeNull();
    expect(mockPatchState).not.toHaveBeenCalled();
  });
});

// ─── round.published ──────────────────────────────────────────────────────────

describe("processEvent – round.published", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("patches state with tables and round info", async () => {
    mockGetState.mockResolvedValue(null);
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckRoundPublishedEvent>("round.published", {
      stage: 1,
      round: 1,
      roundLabel: "Round 1",
      tables: [],
    });

    await processEvent(event);

    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({ currentRound: 1, roundLabel: "Round 1" })
    );
  });
});

// ─── round.started ────────────────────────────────────────────────────────────

describe("processEvent – round.started", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("sets roundStatus to active and stores timer info", async () => {
    mockGetState.mockResolvedValue(null);
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckRoundStartedEvent>("round.started", {
      stage: 1,
      round: 1,
      roundLabel: "Round 1",
      startedAt: NOW,
      roundTimeMinutes: 60,
    });

    await processEvent(event);

    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({
        roundStatus: "active",
        roundStartedAt: NOW,
        roundTimeMinutes: 60,
      })
    );
  });

  it("skips stale round.started if a newer event was already applied", async () => {
    // Simulate: a round.started for round 3 was already processed (lastEventCreated = NOW+1000)
    const existing = { lastEventCreated: NOW + 1000 };
    mockGetState.mockResolvedValue(existing);

    // This event has created=NOW (< NOW+1000) → stale
    const event = withType<TopDeckRoundStartedEvent>("round.started", {
      stage: 1,
      round: 1,
      roundLabel: "Round 1",
      startedAt: NOW,
      roundTimeMinutes: 60,
    });

    const result = await processEvent(event);
    expect(result).toBe(existing);
    expect(mockPatchState).not.toHaveBeenCalled();
  });
});

// ─── tournament.finished ─────────────────────────────────────────────────────

describe("processEvent – tournament.finished", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("sets finished=true and stores winner as TopDeckPlayer", async () => {
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckTournamentFinished>("tournament.finished", {
      endedAt: NOW,
      participantCount: 32,
      winner: { id: "p001", name: "Alice Chen" },
      standings: [],
    });

    await processEvent(event);

    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({
        finished: true,
        winner: { id: "p001", name: "Alice Chen" },
      })
    );
  });
});

// ─── player.registered ────────────────────────────────────────────────────────

describe("processEvent – player.registered", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("adds a player to the roster", async () => {
    mockGetState.mockResolvedValue({ players: [] });
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckPlayerRegistered>("player.registered", {
      player: { id: "p001", name: "Alice Chen" },
      registeredAt: NOW,
    });

    await processEvent(event);

    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({
        players: [{ id: "p001", name: "Alice Chen" }],
      })
    );
  });

  it("does not duplicate a player already in the roster", async () => {
    mockGetState.mockResolvedValue({
      players: [{ id: "p001", name: "Alice Chen" }],
    });
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckPlayerRegistered>("player.registered", {
      player: { id: "p001", name: "Alice Chen" },
      registeredAt: NOW,
    });

    await processEvent(event);

    const callArg = mockPatchState.mock.calls[0][1] as { players: unknown[] };
    expect(callArg.players).toHaveLength(1);
  });
});

// ─── player.dropped ───────────────────────────────────────────────────────────

describe("processEvent – player.dropped", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("adds a DroppedPlayerEntry to the dropped list", async () => {
    mockGetState.mockResolvedValue({ droppedPlayers: [] });
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckPlayerDropped>("player.dropped", {
      player: { id: "p001", name: "Alice Chen" },
      droppedInRound: 1,
    });

    await processEvent(event);

    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({
        droppedPlayers: [
          { player: { id: "p001", name: "Alice Chen" }, droppedInRound: 1 },
        ],
      })
    );
  });

  it("does not duplicate an already-dropped player (dedup by player ID)", async () => {
    const existing: DroppedPlayerEntry[] = [
      { player: { id: "p001", name: "Alice Chen" }, droppedInRound: 1 },
    ];
    mockGetState.mockResolvedValue({ droppedPlayers: existing });
    mockPatchState.mockResolvedValue({ tid: TID });

    const event = withType<TopDeckPlayerDropped>("player.dropped", {
      player: { id: "p001", name: "Alice Chen" },
      droppedInRound: 1,
    });

    await processEvent(event);

    const callArg = mockPatchState.mock.calls[0][1] as {
      droppedPlayers: DroppedPlayerEntry[];
    };
    expect(callArg.droppedPlayers).toHaveLength(1);
  });
});

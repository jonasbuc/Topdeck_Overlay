import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEvent: {
      create: mockCreate,
      findMany: mockFindMany,
    },
  },
}));

// Import AFTER mock is registered
const { storeEvent, getEventsForTournament } = await import(
  "@/lib/topdeck/event-store"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { TopDeckPingEvent } from "@/lib/topdeck/types";

/**
 * Constructs a minimal ping event with correct real-API shapes:
 * - `tid: null` (ping events have no tournament)
 * - `tournament: null` (ping events have no tournament summary)
 * - `created: number` (unix milliseconds, NOT ISO string)
 * - `apiVersion: "2026-07"`
 */
function makePingEvent(id = "evt_001"): TopDeckPingEvent {
  return {
    id,
    tid: null,
    apiVersion: "2026-07",
    created: Date.now(), // unix ms
    type: "ping",
    tournament: null,
    data: { message: "test" },
  };
}

// ─── storeEvent ───────────────────────────────────────────────────────────────

describe("storeEvent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns { stored: true } on successful insert", async () => {
    mockCreate.mockResolvedValue({});
    const result = await storeEvent(makePingEvent(), "{}");
    expect(result.stored).toBe(true);
  });

  it("returns { stored: false, reason: 'duplicate' } on P2002", async () => {
    const prismaError = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(prismaError);
    const result = await storeEvent(makePingEvent(), "{}");
    expect(result.stored).toBe(false);
    if (!result.stored) expect(result.reason).toBe("duplicate");
  });

  it("returns { stored: false, reason: 'error' } on unexpected DB error", async () => {
    mockCreate.mockRejectedValue(new Error("disk full"));
    const result = await storeEvent(makePingEvent(), "{}");
    expect(result.stored).toBe(false);
    if (!result.stored) {
      expect(result.reason).toBe("error");
      expect(result.message).toBe("disk full");
    }
  });
});

// ─── getEventsForTournament ────────────────────────────────────────────────────

describe("getEventsForTournament", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls findMany with correct where clause", async () => {
    mockFindMany.mockResolvedValue([]);
    await getEventsForTournament("tid_001");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tid: "tid_001" } })
    );
  });
});

/**
 * Tests for lib/topdeck/enrichment.ts.
 *
 * Mocks:
 *   - lib/topdeck/tournament-state  → mockGetState, mockPatchState
 *   - lib/topdeck/rest-client       → mockGetRestClient returning mock client
 *   - lib/env                       → TOPDECK_API_KEY set / unset
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock tournament-state ────────────────────────────────────────────────────

const mockGetState = vi.fn();
const mockPatchState = vi.fn();
vi.mock("@/lib/topdeck/tournament-state", () => ({
  getTournamentState: mockGetState,
  patchTournamentState: mockPatchState,
}));

// ─── Mock rest-client ─────────────────────────────────────────────────────────

const mockGetTournamentInfo = vi.fn();
const mockGetAttendees = vi.fn();
const mockClientInstance = {
  getTournamentInfo: mockGetTournamentInfo,
  getAttendees: mockGetAttendees,
};
const mockGetRestClient = vi.fn();

vi.mock("@/lib/topdeck/rest-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/topdeck/rest-client")>(
    "@/lib/topdeck/rest-client"
  );
  return {
    ...actual,
    getRestClient: mockGetRestClient,
  };
});

// ─── Mock env ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: {
    TOPDECK_WEBHOOK_SECRET: "test_secret",
    TOPDECK_API_KEY: "test_api_key",
  },
}));

// Import AFTER mocks are registered
const { enrichTournamentState } = await import("@/lib/topdeck/enrichment");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TID = "tid_enrich_test";

const MOCK_INFO = {
  tid: TID,
  name: "Test Tournament",
  game: "Magic: The Gathering",
  format: "cEDH",
  startDate: 1751500800000,
  endDate: null,
  status: "Ongoing" as const,
  location: { city: "Berlin", country: "DE" },
  headerImage: "https://cdn.topdeck.gg/img/test.jpg",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("enrichTournamentState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetRestClient.mockReturnValue(mockClientInstance);
    mockPatchState.mockResolvedValue({});
  });

  it("skips enrichment when API key is not configured (client=null)", async () => {
    mockGetRestClient.mockReturnValue(null);

    const result = await enrichTournamentState(TID);

    expect(result).toBe(false);
    expect(mockGetTournamentInfo).not.toHaveBeenCalled();
    expect(mockPatchState).not.toHaveBeenCalled();
  });

  it("skips enrichment when tournament is already Complete", async () => {
    mockGetState.mockResolvedValue({
      startDate: 1751500800000,
      status: "Complete",
    });

    const result = await enrichTournamentState(TID);

    expect(result).toBe(false);
    expect(mockGetTournamentInfo).not.toHaveBeenCalled();
  });

  it("runs enrichment when startDate is not yet set", async () => {
    mockGetState.mockResolvedValue({ startDate: null, status: "Not Started" });
    mockGetTournamentInfo.mockResolvedValue(MOCK_INFO);
    mockGetAttendees.mockResolvedValue([]);

    const result = await enrichTournamentState(TID);

    expect(result).toBe(true);
    expect(mockGetTournamentInfo).toHaveBeenCalledWith(TID);
    expect(mockPatchState).toHaveBeenCalledWith(
      TID,
      expect.objectContaining({
        startDate: MOCK_INFO.startDate,
        status: "Ongoing",
        location: MOCK_INFO.location,
        headerImage: MOCK_INFO.headerImage,
      })
    );
  });

  it("runs enrichment when state does not exist yet (null)", async () => {
    mockGetState.mockResolvedValue(null);
    mockGetTournamentInfo.mockResolvedValue(MOCK_INFO);
    mockGetAttendees.mockResolvedValue([]);

    const result = await enrichTournamentState(TID);

    expect(result).toBe(true);
  });

  it("patches waitlistPlayers when attendees include waitlist entries", async () => {
    mockGetState.mockResolvedValue({ startDate: null });
    mockGetTournamentInfo.mockResolvedValue(MOCK_INFO);

    const waitlisted = [
      {
        uid: "w1",
        name: "Waitlisted Player",
        email: null,
        discord: null,
        discordId: null,
        status: "waitlist" as const,
        standing: null,
        decklist: null,
        deckObj: null,
        waitlistPosition: 1,
      },
    ];
    mockGetAttendees.mockResolvedValue(waitlisted);

    await enrichTournamentState(TID);

    // patchState called twice: once for info, once for waitlist
    const patchCalls = mockPatchState.mock.calls;
    const waitlistPatch = patchCalls.find(
      ([, patch]) => "waitlistPlayers" in patch
    );
    expect(waitlistPatch).toBeDefined();
    expect(waitlistPatch![1].waitlistPlayers).toHaveLength(1);
  });

  it("returns false (and does not throw) when REST API returns 404", async () => {
    const { TopDeckApiError } = await import("@/lib/topdeck/rest-client");
    mockGetState.mockResolvedValue(null);
    mockGetTournamentInfo.mockRejectedValue(
      new TopDeckApiError(404, "Not Found", "/test")
    );

    const result = await enrichTournamentState(TID);

    expect(result).toBe(false);
    expect(mockPatchState).not.toHaveBeenCalled();
  });

  it("silently ignores 403 on getAttendees (not a judge)", async () => {
    const { TopDeckApiError } = await import("@/lib/topdeck/rest-client");
    mockGetState.mockResolvedValue(null);
    mockGetTournamentInfo.mockResolvedValue(MOCK_INFO);
    mockGetAttendees.mockRejectedValue(
      new TopDeckApiError(403, "Forbidden", "/test")
    );

    // Should NOT throw
    const result = await enrichTournamentState(TID);

    expect(result).toBe(true); // enrichment still ran for info
    // waitlist patch should NOT have been called
    const patchCalls = mockPatchState.mock.calls;
    const waitlistPatch = patchCalls.find(
      ([, patch]) => "waitlistPlayers" in patch
    );
    expect(waitlistPatch).toBeUndefined();
  });
});

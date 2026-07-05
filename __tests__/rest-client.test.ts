/**
 * Tests for lib/topdeck/rest-client.ts and lib/topdeck/enrichment.ts.
 *
 * Strategy: mock global `fetch` with `vi.stubGlobal`. This avoids any real
 * network calls and lets us test the client's typed wrappers, error handling,
 * and the enrichment side effects in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TopDeckRestClient,
  TopDeckApiError,
  getRestClient,
  TOPDECK_API_BASE,
} from "@/lib/topdeck/rest-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_KEY = "test_key_xyz";

/** Build a mock Response for vi.stubGlobal("fetch", ...). */
function mockFetch(
  body: unknown,
  status = 200
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const MOCK_INFO = {
  tid: "tid_abc",
  name: "cEDH Regional 2026",
  game: "Magic: The Gathering",
  format: "cEDH",
  startDate: 1751500800000,
  endDate: null,
  status: "Ongoing",
  location: { city: "Berlin", country: "DE" },
  headerImage: "https://cdn.topdeck.gg/events/abc.jpg",
};

const MOCK_STANDINGS = [
  { standing: 1, name: "Alice Chen", id: "p001", points: 9, winRate: 1.0, opponentWinRate: 0.75 },
  { standing: 2, name: "Bob Martinez", id: "p002", points: 6, winRate: 0.67, opponentWinRate: 0.58 },
];

// ─── TopDeckRestClient ────────────────────────────────────────────────────────

describe("TopDeckRestClient", () => {
  let client: TopDeckRestClient;

  beforeEach(() => {
    client = new TopDeckRestClient(API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── getTournamentInfo ──────────────────────────────────────────────────

  describe("getTournamentInfo", () => {
    it("calls the correct URL with Authorization header", async () => {
      vi.stubGlobal("fetch", mockFetch(MOCK_INFO));

      const result = await client.getTournamentInfo("tid_abc");

      expect(result).toEqual(MOCK_INFO);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${TOPDECK_API_BASE}/tournaments/tid_abc/info`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: API_KEY }),
        })
      );
    });

    it("throws TopDeckApiError on 401", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "unauthorized" }, 401));

      await expect(client.getTournamentInfo("tid_abc")).rejects.toThrow(
        TopDeckApiError
      );
    });

    it("throws TopDeckApiError with correct status on 404", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "not found" }, 404));

      try {
        await client.getTournamentInfo("tid_missing");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TopDeckApiError);
        expect((err as TopDeckApiError).status).toBe(404);
      }
    });

    it("re-throws network errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      );

      await expect(client.getTournamentInfo("tid_abc")).rejects.toThrow(
        TypeError
      );
    });
  });

  // ── getStandings ───────────────────────────────────────────────────────

  describe("getStandings", () => {
    it("requests latest standings by default", async () => {
      vi.stubGlobal("fetch", mockFetch(MOCK_STANDINGS));

      const result = await client.getStandings("tid_abc");

      expect(result).toEqual(MOCK_STANDINGS);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${TOPDECK_API_BASE}/tournaments/tid_abc/rounds/latest/standings`,
        expect.anything()
      );
    });

    it("requests a specific round when provided", async () => {
      vi.stubGlobal("fetch", mockFetch(MOCK_STANDINGS));

      await client.getStandings("tid_abc", 3);

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${TOPDECK_API_BASE}/tournaments/tid_abc/rounds/3/standings`,
        expect.anything()
      );
    });

    it("throws TopDeckApiError on 502", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "bad gateway" }, 502));

      await expect(client.getStandings("tid_abc")).rejects.toThrow(
        TopDeckApiError
      );
    });
  });

  // ── getAttendees ───────────────────────────────────────────────────────

  describe("getAttendees", () => {
    it("calls the attendees endpoint", async () => {
      const attendees = [
        { uid: "u1", name: "Alice", email: null, discord: null, discordId: null, status: "player" },
      ];
      vi.stubGlobal("fetch", mockFetch(attendees));

      const result = await client.getAttendees("tid_abc");

      expect(result).toEqual(attendees);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${TOPDECK_API_BASE}/tournaments/tid_abc/attendees`,
        expect.anything()
      );
    });

    it("throws TopDeckApiError on 403", async () => {
      vi.stubGlobal("fetch", mockFetch({ error: "forbidden" }, 403));

      try {
        await client.getAttendees("tid_abc");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TopDeckApiError);
        expect((err as TopDeckApiError).status).toBe(403);
      }
    });
  });

  // ── getMyTournaments ───────────────────────────────────────────────────

  describe("getMyTournaments", () => {
    it("calls the /me/tournaments endpoint", async () => {
      vi.stubGlobal("fetch", mockFetch([MOCK_INFO]));

      const result = await client.getMyTournaments();

      expect(result).toEqual([MOCK_INFO]);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${TOPDECK_API_BASE}/me/tournaments`,
        expect.anything()
      );
    });
  });
});

// ─── getRestClient (singleton) ────────────────────────────────────────────────

describe("getRestClient", () => {
  it("returns null when apiKey is null", () => {
    expect(getRestClient(null)).toBeNull();
  });

  it("returns a TopDeckRestClient instance for a non-null key", () => {
    const client = getRestClient("some_key");
    expect(client).toBeInstanceOf(TopDeckRestClient);
  });
});

// ─── TopDeckApiError ──────────────────────────────────────────────────────────

describe("TopDeckApiError", () => {
  it("has correct name and properties", () => {
    const err = new TopDeckApiError(404, "Not Found", "/test", "body text");
    expect(err.name).toBe("TopDeckApiError");
    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.endpoint).toBe("/test");
    expect(err.body).toBe("body text");
    expect(err.message).toContain("404");
  });
});

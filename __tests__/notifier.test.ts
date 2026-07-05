/**
 * Tests for lib/discord/notifier.ts
 *
 * The notifier is a pure side-effect module — it reads env/DB, calls the
 * Discord REST API, and must never throw. We test it by mocking all external
 * collaborators and asserting on sendDiscordMessage calls.
 *
 * Covers:
 *   - Early exits (no token, no link)
 *   - round.published → pairings (enabled/disabled, empty tables)
 *   - round.started   → round-started embed (enabled/disabled, with/without timer)
 *   - round.ended     → standings embed (enabled/disabled)
 *   - tournament.finished → final standings embed (enabled/disabled, winner)
 *   - tournament.checkin_started → parking embed (enabled/disabled, no location)
 *   - Batching: >10 pairings embeds → multiple sendDiscordMessage calls
 *   - Error swallowing: sendDiscordMessage throws → notify still resolves
 *   - buildRoundStartedEmbed: timer formatting
 *   - buildFinalStandingsEmbed: winner line, medals, topN, footer
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Mock all external collaborators ─────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: { DISCORD_BOT_TOKEN: "test-token", PARKING_PROVIDER: "overpass" },
}));

vi.mock("@/lib/discord/config-service", () => ({
  getLinkByTid: vi.fn(),
}));

vi.mock("@/lib/discord/rest", () => ({
  sendDiscordMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/parking/geocoder", () => ({
  geocodeAddress: vi.fn(),
}));

vi.mock("@/lib/parking/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/parking/factory", () => ({
  createParkingProvider: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { notify, buildRoundStartedEmbed, buildFinalStandingsEmbed } from "@/lib/discord/notifier";
import { getLinkByTid } from "@/lib/discord/config-service";
import { sendDiscordMessage } from "@/lib/discord/rest";
import { getCached } from "@/lib/parking/cache";
import { geocodeAddress } from "@/lib/parking/geocoder";
import { createParkingProvider } from "@/lib/parking/factory";
import { env } from "@/lib/env";
import { DEFAULT_SETTINGS } from "@/lib/discord/types";
import type { LiveTournamentState, TopDeckStanding, TopDeckTable } from "@/lib/topdeck/types";
import type { DiscordLinkRecord } from "@/lib/discord/config-service";
import type { ParkingResult } from "@/lib/parking/types";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeLink(overrides: Partial<DiscordLinkRecord> = {}): DiscordLinkRecord {
  return {
    id: "link-1",
    tid: "t_test",
    guildId: "guild-1",
    channelId: "channel-1",
    settings: { ...DEFAULT_SETTINGS },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeState(overrides: Partial<LiveTournamentState> = {}): LiveTournamentState {
  return {
    tid: "t_test",
    name: "Test Tournament",
    game: "MTG",
    format: "Standard",
    startDate: null,
    status: "Ongoing",
    location: null,
    headerImage: null,
    currentStage: 1,
    currentRound: 3,
    roundLabel: "3",
    roundStatus: "active",
    roundStartedAt: null,
    roundTimeMinutes: null,
    tables: [],
    matchResults: [],
    standings: [],
    players: [],
    droppedPlayers: [],
    waitlistPlayers: [],
    roundHistory: [],
    checkinStarted: false,
    checkinStage: null,
    finished: false,
    finishedAt: null,
    winner: null,
    participantCount: null,
    lastEventId: "evt_1",
    lastEventCreated: Date.now(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStanding(standing: number): TopDeckStanding {
  return {
    standing,
    name: `Player ${standing}`,
    id: `p_${standing}`,
    points: 10 - standing,
    winRate: 0.7 - standing * 0.05,
    opponentWinRate: 0.5,
  };
}

function makeTable(num: number): TopDeckTable {
  return {
    table: num,
    players: [
      { id: `p1`, name: `A` },
      { id: `p2`, name: `B` },
    ],
    winner: null,
    winner_id: null,
    winner_games: null,
    loser_games: null,
    status: "Pending",
  };
}

function makeBaseEnvelope(type: string, data: unknown) {
  return {
    id: `evt_${type}`,
    type,
    created: Date.now(),
    apiVersion: "2026-07",
    tid: "t_test",
    tournament: { name: "Test Tournament", game: "MTG", format: "Standard" },
    data,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (getLinkByTid as Mock).mockResolvedValue(makeLink());
  (sendDiscordMessage as Mock).mockResolvedValue(true);
  (getCached as Mock).mockResolvedValue(null);
  (geocodeAddress as Mock).mockResolvedValue({ lat: 48.2, lng: 16.4 });
  (createParkingProvider as Mock).mockReturnValue({
    name: "overpass",
    attribution: "© OpenStreetMap contributors",
    fetchNearby: vi.fn().mockResolvedValue([
      {
        id: "p1",
        name: "Garage",
        address: "123 Main St",
        lat: 48.2,
        lng: 16.4,
        distanceMeters: 200,
        walkingMinutes: 3,
        drivingMinutes: null,
        priceInfo: "Free",
        openingHours: null,
        rating: null,
        ratingCount: null,
        accessible: null,
        navigationUrl: "https://maps.google.com/?q=48.2,16.4",
        source: "overpass",
      } satisfies ParkingResult,
    ]),
  });
});

// ─── 1. Early exits ───────────────────────────────────────────────────────────

describe("notify — early exits", () => {
  it("does nothing when DISCORD_BOT_TOKEN is not set", async () => {
    const originalToken = env.DISCORD_BOT_TOKEN;
    (env as { DISCORD_BOT_TOKEN: string | null }).DISCORD_BOT_TOKEN = null;

    await notify(makeBaseEnvelope("round.ended", { stage: 1, round: 1, roundLabel: "1", standings: [makeStanding(1)] }) as never, makeState());
    expect(sendDiscordMessage).not.toHaveBeenCalled();

    (env as { DISCORD_BOT_TOKEN: string | null }).DISCORD_BOT_TOKEN = originalToken;
  });

  it("does nothing when tournament has no Discord link", async () => {
    (getLinkByTid as Mock).mockResolvedValue(null);
    await notify(makeBaseEnvelope("round.ended", { stage: 1, round: 1, roundLabel: "1", standings: [makeStanding(1)] }) as never, makeState());
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });
});

// ─── 2. round.published → pairings ───────────────────────────────────────────

describe("notify — round.published", () => {
  it("sends pairings when postPairings=true", async () => {
    const tables = [1, 2, 3].map(makeTable);
    await notify(
      makeBaseEnvelope("round.published", { stage: 1, round: 3, roundLabel: "3", tables }) as never,
      makeState()
    );
    expect(sendDiscordMessage).toHaveBeenCalledOnce();
    const [, , msg] = (sendDiscordMessage as Mock).mock.calls[0];
    expect(msg.embeds).toHaveLength(1); // 3 tables fit in 1 embed (TABLES_PER_EMBED=5)
  });

  it("skips when postPairings=false", async () => {
    (getLinkByTid as Mock).mockResolvedValue(makeLink({ settings: { ...DEFAULT_SETTINGS, postPairings: false } }));
    await notify(
      makeBaseEnvelope("round.published", { stage: 1, round: 3, roundLabel: "3", tables: [makeTable(1)] }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("skips when tables array is empty", async () => {
    await notify(
      makeBaseEnvelope("round.published", { stage: 1, round: 3, roundLabel: "3", tables: [] }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("sends multiple messages for >10 pairings embeds (11 embeds → 2 messages)", async () => {
    // 55 tables → 11 embeds (TABLES_PER_EMBED=5) → 2 sendDiscordMessage calls
    const tables = Array.from({ length: 55 }, (_, i) => makeTable(i + 1));
    await notify(
      makeBaseEnvelope("round.published", { stage: 1, round: 1, roundLabel: "1", tables }) as never,
      makeState()
    );
    expect(sendDiscordMessage).toHaveBeenCalledTimes(2);
    // First call: 10 embeds, second call: 1 embed
    expect((sendDiscordMessage as Mock).mock.calls[0][2].embeds).toHaveLength(10);
    expect((sendDiscordMessage as Mock).mock.calls[1][2].embeds).toHaveLength(1);
  });
});

// ─── 3. round.started ────────────────────────────────────────────────────────

describe("notify — round.started", () => {
  it("sends round started embed when postRoundStarted=true", async () => {
    await notify(
      makeBaseEnvelope("round.started", { stage: 1, round: 3, roundLabel: "3", startedAt: Date.now(), roundTimeMinutes: 50 }) as never,
      makeState()
    );
    expect(sendDiscordMessage).toHaveBeenCalledOnce();
    const [, , msg] = (sendDiscordMessage as Mock).mock.calls[0];
    expect(msg.embeds[0].title).toContain("Round 3 has started");
    expect(msg.embeds[0].description).toContain("50 minutes");
  });

  it("skips when postRoundStarted=false", async () => {
    (getLinkByTid as Mock).mockResolvedValue(makeLink({ settings: { ...DEFAULT_SETTINGS, postRoundStarted: false } }));
    await notify(
      makeBaseEnvelope("round.started", { stage: 1, round: 3, roundLabel: "3", startedAt: null, roundTimeMinutes: null }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });
});

// ─── 4. round.ended → standings ──────────────────────────────────────────────

describe("notify — round.ended", () => {
  it("sends standings embed when postStandings=true", async () => {
    const standings = Array.from({ length: 8 }, (_, i) => makeStanding(i + 1));
    await notify(
      makeBaseEnvelope("round.ended", { stage: 1, round: 3, roundLabel: "3", standings }) as never,
      makeState()
    );
    expect(sendDiscordMessage).toHaveBeenCalledOnce();
    const [, , msg] = (sendDiscordMessage as Mock).mock.calls[0];
    expect(msg.embeds[0].title).toContain("Round 3");
  });

  it("skips when postStandings=false", async () => {
    (getLinkByTid as Mock).mockResolvedValue(makeLink({ settings: { ...DEFAULT_SETTINGS, postStandings: false } }));
    await notify(
      makeBaseEnvelope("round.ended", { stage: 1, round: 3, roundLabel: "3", standings: [makeStanding(1)] }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("skips when standings array is empty", async () => {
    await notify(
      makeBaseEnvelope("round.ended", { stage: 1, round: 3, roundLabel: "3", standings: [] }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });
});

// ─── 5. tournament.finished → final standings ────────────────────────────────

describe("notify — tournament.finished", () => {
  it("sends final standings embed when postStandings=true", async () => {
    const standings = Array.from({ length: 4 }, (_, i) => makeStanding(i + 1));
    const winner = { id: "p_1", name: "Player 1" };
    await notify(
      makeBaseEnvelope("tournament.finished", {
        endedAt: Date.now(),
        participantCount: 4,
        winner,
        standings,
      }) as never,
      makeState()
    );
    expect(sendDiscordMessage).toHaveBeenCalledOnce();
    const [, , msg] = (sendDiscordMessage as Mock).mock.calls[0];
    expect(msg.embeds[0].title).toContain("Final Results");
    expect(msg.embeds[0].description).toContain("Winner: Player 1");
  });

  it("skips when postStandings=false", async () => {
    (getLinkByTid as Mock).mockResolvedValue(makeLink({ settings: { ...DEFAULT_SETTINGS, postStandings: false } }));
    await notify(
      makeBaseEnvelope("tournament.finished", { endedAt: null, participantCount: null, winner: null, standings: [] }) as never,
      makeState()
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });
});

// ─── 6. tournament.checkin_started → parking ─────────────────────────────────

describe("notify — tournament.checkin_started", () => {
  const locationState = makeState({
    location: { lat: 48.2, lng: 16.4, city: "Vienna", country: "AT" },
  });

  it("sends parking embed when postParking=true and location present", async () => {
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      locationState
    );
    expect(sendDiscordMessage).toHaveBeenCalledOnce();
    const [, , msg] = (sendDiscordMessage as Mock).mock.calls[0];
    expect(msg.embeds[0].title).toContain("Parking");
  });

  it("skips when postParking=false", async () => {
    (getLinkByTid as Mock).mockResolvedValue(makeLink({ settings: { ...DEFAULT_SETTINGS, postParking: false } }));
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      locationState
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("skips when state has no location", async () => {
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      makeState() // location: null
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("geocodes when location has no lat/lng", async () => {
    const noCoordState = makeState({ location: { city: "Vienna", country: "AT" } });
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      noCoordState
    );
    expect(geocodeAddress).toHaveBeenCalled();
    expect(sendDiscordMessage).toHaveBeenCalled();
  });

  it("skips parking send when geocoding returns null", async () => {
    (geocodeAddress as Mock).mockResolvedValue(null);
    const noCoordState = makeState({ location: { city: "Nowhere" } });
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      noCoordState
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("skips parking send when provider returns no results", async () => {
    (createParkingProvider as Mock).mockReturnValue({
      name: "overpass",
      attribution: "© OSM",
      fetchNearby: vi.fn().mockResolvedValue([]),
    });
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      locationState
    );
    expect(sendDiscordMessage).not.toHaveBeenCalled();
  });

  it("uses cache when available (does not call provider)", async () => {
    (getCached as Mock).mockResolvedValue({
      provider: "overpass",
      results: [
        {
          id: "cached",
          name: "Cached Parking",
          address: "",
          lat: 48.2,
          lng: 16.4,
          distanceMeters: 150,
          walkingMinutes: 2,
          drivingMinutes: null,
          priceInfo: null,
          openingHours: null,
          rating: null,
          ratingCount: null,
          accessible: null,
          navigationUrl: "https://maps.google.com/?q=48.2,16.4",
          source: "overpass",
        } satisfies ParkingResult,
      ],
    });
    await notify(
      makeBaseEnvelope("tournament.checkin_started", { stage: 1 }) as never,
      locationState
    );
    const provider = (createParkingProvider as Mock)();
    expect(provider.fetchNearby).not.toHaveBeenCalled();
    expect(sendDiscordMessage).toHaveBeenCalled();
  });
});

// ─── 7. Error resilience ──────────────────────────────────────────────────────

describe("notify — error resilience", () => {
  it("resolves without throwing even if sendDiscordMessage rejects", async () => {
    (sendDiscordMessage as Mock).mockRejectedValue(new Error("Discord 503"));
    const standings = [makeStanding(1)];
    await expect(
      notify(
        makeBaseEnvelope("round.ended", { stage: 1, round: 1, roundLabel: "1", standings }) as never,
        makeState()
      )
    ).resolves.toBeUndefined();
  });

  it("resolves without throwing if getLinkByTid rejects", async () => {
    (getLinkByTid as Mock).mockRejectedValue(new Error("DB down"));
    await expect(
      notify(
        makeBaseEnvelope("round.ended", { stage: 1, round: 1, roundLabel: "1", standings: [makeStanding(1)] }) as never,
        makeState()
      )
    ).resolves.toBeUndefined();
  });
});

// ─── 8. buildRoundStartedEmbed ────────────────────────────────────────────────

describe("buildRoundStartedEmbed", () => {
  it("includes timer when roundTimeMinutes is set", () => {
    const embed = buildRoundStartedEmbed("3", 50, "Test");
    expect(embed.description).toContain("50 minutes");
    expect(embed.title).toContain("Round 3 has started");
  });

  it("formats hours + minutes for long rounds", () => {
    const embed = buildRoundStartedEmbed("1", 90, "Test");
    expect(embed.description).toContain("1h 30m");
  });

  it("shows 'untimed' when roundTimeMinutes is null", () => {
    const embed = buildRoundStartedEmbed("3", null, "Test");
    expect(embed.description).toContain("untimed");
  });

  it("uses label as-is for non-numeric roundLabel (e.g. Top 4)", () => {
    const embed = buildRoundStartedEmbed("Top 4", 50, "Test");
    expect(embed.title).toContain("Top 4 has started");
    expect(embed.title).not.toContain("Round");
  });

  it("has correct footer text", () => {
    const embed = buildRoundStartedEmbed("5", 50, "Open 2026");
    expect(embed.footer?.text).toBe("Open 2026");
  });
});

// ─── 9. buildFinalStandingsEmbed ──────────────────────────────────────────────

describe("buildFinalStandingsEmbed", () => {
  const standings = Array.from({ length: 8 }, (_, i) => makeStanding(i + 1));

  it("includes winner line when winner is provided", () => {
    const embed = buildFinalStandingsEmbed(standings, { id: "p1", name: "Champion" }, "Test", 8);
    expect(embed.description).toContain("Winner: Champion");
  });

  it("omits winner line when winner is null", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Test", 8);
    expect(embed.description).not.toContain("Winner:");
  });

  it("includes medal emojis for top 3", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Test", 8);
    expect(embed.description).toContain("🥇");
    expect(embed.description).toContain("🥈");
    expect(embed.description).toContain("🥉");
  });

  it("respects topN and shows truncation note", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Test", 3);
    expect(embed.description).toContain("5 more");
  });

  it("shows all players when topN=0", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Test", 0);
    expect(embed.description).not.toContain("more");
  });

  it("has Final Results title", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Open 2026", 8);
    expect(embed.title).toContain("Final Results");
    expect(embed.title).toContain("Open 2026");
  });

  it("footer includes player count", () => {
    const embed = buildFinalStandingsEmbed(standings, null, "Open 2026", 8);
    expect(embed.footer?.text).toContain("8 players");
  });
});

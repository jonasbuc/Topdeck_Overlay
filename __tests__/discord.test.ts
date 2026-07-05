/**
 * Tests for the Discord integration foundation (phase 4).
 *
 * Covers:
 *   - lib/discord/verify.ts          — Ed25519 signature verification
 *   - lib/discord/types.ts           — mergeSettings, hasManageChannels
 *   - lib/discord/commands/standings.ts — buildStandingsEmbed (pure)
 *   - lib/discord/commands/pairings.ts  — buildPairingsEmbeds (pure)
 */

import { describe, it, expect, vi } from "vitest";
import nacl from "tweetnacl";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ed25519 signature verification
// ─────────────────────────────────────────────────────────────────────────────

import { verifyDiscordSignature } from "@/lib/discord/verify";

// Generate a real Ed25519 key pair for testing
const keyPair = nacl.sign.keyPair();
const PUBLIC_KEY_HEX = Buffer.from(keyPair.publicKey).toString("hex");
const SECRET_KEY = keyPair.secretKey;

function signMessage(timestamp: string, body: string): string {
  const message = new TextEncoder().encode(timestamp + body);
  const sig = nacl.sign.detached(message, SECRET_KEY);
  return Buffer.from(sig).toString("hex");
}

const TIMESTAMP = "1751500800";
const BODY = '{"type":1}';

describe("verifyDiscordSignature", () => {
  it("returns ok:true for a valid signature", () => {
    const sig = signMessage(TIMESTAMP, BODY);
    const result = verifyDiscordSignature(BODY, TIMESTAMP, sig, PUBLIC_KEY_HEX);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when timestamp header is missing", () => {
    const sig = signMessage(TIMESTAMP, BODY);
    const result = verifyDiscordSignature(BODY, null, sig, PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/timestamp/i);
  });

  it("returns ok:false when signature header is missing", () => {
    const result = verifyDiscordSignature(BODY, TIMESTAMP, null, PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/signature/i);
  });

  it("returns ok:false for a tampered body", () => {
    const sig = signMessage(TIMESTAMP, BODY);
    const result = verifyDiscordSignature('{"type":2}', TIMESTAMP, sig, PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/verification failed/i);
  });

  it("returns ok:false for a tampered timestamp", () => {
    const sig = signMessage(TIMESTAMP, BODY);
    const result = verifyDiscordSignature(BODY, "9999999999", sig, PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for a malformed signature hex string", () => {
    const result = verifyDiscordSignature(BODY, TIMESTAMP, "not-hex!!", PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/hex/i);
  });

  it("returns ok:false for a signature with wrong length", () => {
    const result = verifyDiscordSignature(BODY, TIMESTAMP, "abcd1234", PUBLIC_KEY_HEX);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/64-byte/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. mergeSettings + hasManageChannels
// ─────────────────────────────────────────────────────────────────────────────

import { mergeSettings, DEFAULT_SETTINGS, hasManageChannels } from "@/lib/discord/types";

describe("mergeSettings", () => {
  it("returns defaults when empty object is passed", () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("overrides only specified fields, keeping others as defaults", () => {
    const result = mergeSettings({ postResults: true, topNStandings: 16 });
    expect(result.postResults).toBe(true);
    expect(result.topNStandings).toBe(16);
    // Unchanged fields stay at default
    expect(result.postPairings).toBe(DEFAULT_SETTINGS.postPairings);
    expect(result.mentionPlayers).toBe(DEFAULT_SETTINGS.mentionPlayers);
  });

  it("handles unknown extra keys gracefully (spreads them out)", () => {
    const result = mergeSettings({ postPairings: false } as Parameters<typeof mergeSettings>[0]);
    expect(result.postPairings).toBe(false);
  });
});

describe("hasManageChannels", () => {
  // MANAGE_CHANNELS is bit 4 = decimal 16
  it("returns true when MANAGE_CHANNELS bit is set", () => {
    // 16 in decimal = 0b10000
    expect(hasManageChannels("16")).toBe(true);
  });

  it("returns true when multiple permissions include MANAGE_CHANNELS", () => {
    // 16 | 8 | 4 = 28
    expect(hasManageChannels("28")).toBe(true);
  });

  it("returns false when MANAGE_CHANNELS bit is not set", () => {
    expect(hasManageChannels("8")).toBe(false);
  });

  it("returns false for '0'", () => {
    expect(hasManageChannels("0")).toBe(false);
  });

  it("returns false for non-numeric string", () => {
    expect(hasManageChannels("not-a-number")).toBe(false);
  });

  it("handles large Discord permission integers (> 53-bit safe integer)", () => {
    // Administrator = 2^3 = 8, but in a very large bitmask
    // MANAGE_CHANNELS is bit 4 = 16
    const largeWithManage = "549755813904"; // includes bit 4
    expect(hasManageChannels(largeWithManage)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. buildStandingsEmbed (pure function, no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────

import { buildStandingsEmbed } from "@/lib/discord/commands/standings";
import type { TopDeckStanding } from "@/lib/topdeck/types";

function makeStanding(standing: number, points: number): TopDeckStanding {
  return {
    standing,
    name: `Player ${standing}`,
    id: `p_${standing}`,
    points,
    winRate: (points / 12),
    opponentWinRate: 0.5,
  };
}

describe("buildStandingsEmbed", () => {
  const standings = Array.from({ length: 10 }, (_, i) =>
    makeStanding(i + 1, 12 - i)
  );

  it("shows medals for top 3 players", () => {
    const embed = buildStandingsEmbed(standings, 8, "Test Tournament", "6");
    expect(embed.description).toContain("🥇");
    expect(embed.description).toContain("🥈");
    expect(embed.description).toContain("🥉");
  });

  it("respects topN limit", () => {
    const embed = buildStandingsEmbed(standings, 3, "Test", "6");
    // Should show 3 players + "... and N more" line
    expect(embed.description).toContain("7 more");
  });

  it("adds 'Round X' prefix for numeric roundLabel", () => {
    const embed = buildStandingsEmbed(standings, 8, "Test", "6");
    expect(embed.title).toContain("Round 6");
  });

  it("uses the label as-is for non-numeric roundLabel", () => {
    const embed = buildStandingsEmbed(standings, 8, "Test", "Top 4");
    expect(embed.title).toContain("Top 4");
  });

  it("includes the tournament name as footer", () => {
    const embed = buildStandingsEmbed(standings, 8, "Open 2026", "6");
    expect(embed.footer?.text).toBe("Open 2026");
  });

  it("topN=0 shows all players with no truncation", () => {
    const embed = buildStandingsEmbed(standings, 0, "Test", "6");
    expect(embed.description).not.toContain("more");
    // All 10 players listed
    for (let i = 1; i <= 10; i++) {
      expect(embed.description).toContain(`Player ${i}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. buildPairingsEmbeds (pure function, no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────

import { buildPairingsEmbeds } from "@/lib/discord/commands/pairings";
import type { TopDeckTable } from "@/lib/topdeck/types";

function makePodTable(num: number): TopDeckTable {
  return {
    table: num,
    players: [
      { id: `p1t${num}`, name: `Player A (T${num})` },
      { id: `p2t${num}`, name: `Player B (T${num})` },
      { id: `p3t${num}`, name: `Player C (T${num})` },
      { id: `p4t${num}`, name: `Player D (T${num})` },
    ],
    winner: null,
    winner_id: null,
    winner_games: null,
    loser_games: null,
    status: "Pending",
  };
}

describe("buildPairingsEmbeds", () => {
  it("returns a single embed for <= 5 tables", () => {
    const tables = [1, 2, 3].map(makePodTable);
    const embeds = buildPairingsEmbeds(tables, "Round 3", "Test");
    expect(embeds).toHaveLength(1);
  });

  it("splits into multiple embeds for > 5 tables", () => {
    const tables = Array.from({ length: 8 }, (_, i) => makePodTable(i + 1));
    const embeds = buildPairingsEmbeds(tables, "Round 3", "Test");
    expect(embeds.length).toBeGreaterThan(1);
  });

  it("first embed has title and description", () => {
    const tables = [makePodTable(1)];
    const [embed] = buildPairingsEmbeds(tables, "Round 3", "Test");
    expect(embed.title).toContain("Round 3");
    expect(embed.description).toContain("Test");
  });

  it("formats pod tables with Seat labels", () => {
    const tables = [makePodTable(1)];
    const [embed] = buildPairingsEmbeds(tables, "Round 3", "Test");
    expect(embed.fields?.[0].value).toContain("Seat 1");
    expect(embed.fields?.[0].value).toContain("Seat 4");
  });

  it("each embed has fields for its tables", () => {
    const tables = [1, 2, 3, 4, 5, 6].map(makePodTable);
    const embeds = buildPairingsEmbeds(tables, "Round 3", "Test");
    const totalFields = embeds.reduce((n, e) => n + (e.fields?.length ?? 0), 0);
    expect(totalFields).toBe(6); // one field per table
  });
});

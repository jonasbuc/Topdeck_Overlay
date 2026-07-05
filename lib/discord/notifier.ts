/**
 * Discord notifier — bridges TopDeck webhook events to Discord messages.
 *
 * Called by the webhook handler after each event is successfully processed.
 *
 * Rules:
 *   - Silently skips if DISCORD_BOT_TOKEN is not set (Discord is optional)
 *   - Silently skips if the tournament has no Discord link
 *   - Respects the per-link settings (postPairings, postStandings, etc.)
 *   - NEVER propagates errors — Discord delivery must not fail the webhook handler
 *   - NEVER logs the bot token
 */

import { env } from "@/lib/env";
import { getLinkByTid } from "./config-service";
import { sendDiscordMessage } from "./rest";
import { buildStandingsEmbed } from "./commands/standings";
import { buildPairingsEmbeds } from "./commands/pairings";
import { buildParkingEmbed, buildAddress } from "./commands/parking";
import { geocodeAddress } from "@/lib/parking/geocoder";
import { getCached, setCache } from "@/lib/parking/cache";
import { createParkingProvider } from "@/lib/parking/factory";
import type {
  TopDeckWebhookEvent,
  LiveTournamentState,
  TopDeckStanding,
  TopDeckPlayer,
} from "@/lib/topdeck/types";
import type { DiscordEmbed } from "./types";

/** Discord's hard cap on embeds per message. */
const MAX_EMBEDS_PER_MESSAGE = 10;

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Send Discord notifications (if configured + tournament is linked) for a
 * processed TopDeck webhook event.
 *
 * This is intentionally fire-and-forget from the webhook route — it does not
 * need to complete before the 200 response is sent.
 */
export async function notify(
  event: TopDeckWebhookEvent,
  state: LiveTournamentState
): Promise<void> {
  const token = env.DISCORD_BOT_TOKEN;
  if (!token) return; // Discord not configured

  try {
    const link = await getLinkByTid(state.tid);
    if (!link) return; // Tournament not linked to any Discord channel

    const { settings, channelId } = link;

    switch (event.type) {
      // ── Pairings ──────────────────────────────────────────────────────────
      case "round.published": {
        if (!settings.postPairings) break;
        const { tables, roundLabel } = event.data;
        if (tables.length === 0) break;
        const embeds = buildPairingsEmbeds(tables, String(roundLabel), state.name);
        await sendEmbedBatches(token, channelId, embeds);
        console.info(
          `[discord:notifier] pairings sent tid=${state.tid} round=${roundLabel} ` +
            `tables=${tables.length} embeds=${embeds.length}`
        );
        break;
      }

      // ── Round started ─────────────────────────────────────────────────────
      case "round.started": {
        if (!settings.postRoundStarted) break;
        const { roundLabel, roundTimeMinutes } = event.data;
        const embed = buildRoundStartedEmbed(
          String(roundLabel),
          roundTimeMinutes,
          state.name
        );
        await sendDiscordMessage(token, channelId, { embeds: [embed] });
        console.info(
          `[discord:notifier] round.started sent tid=${state.tid} round=${roundLabel}`
        );
        break;
      }

      // ── Standings after each round ────────────────────────────────────────
      case "round.ended": {
        if (!settings.postStandings) break;
        const { standings, roundLabel } = event.data;
        if (standings.length === 0) break;
        const embed = buildStandingsEmbed(
          standings,
          settings.topNStandings,
          state.name,
          String(roundLabel)
        );
        await sendDiscordMessage(token, channelId, { embeds: [embed] });
        console.info(
          `[discord:notifier] standings sent tid=${state.tid} round=${roundLabel} ` +
            `players=${standings.length}`
        );
        break;
      }

      // ── Final standings ───────────────────────────────────────────────────
      case "tournament.finished": {
        if (!settings.postStandings) break;
        const { standings, winner } = event.data;
        const embed = buildFinalStandingsEmbed(
          standings,
          winner,
          state.name,
          settings.topNStandings
        );
        await sendDiscordMessage(token, channelId, { embeds: [embed] });
        console.info(
          `[discord:notifier] final standings sent tid=${state.tid} winner=${winner?.name ?? "none"}`
        );
        break;
      }

      // ── Parking at check-in ───────────────────────────────────────────────
      case "tournament.checkin_started": {
        if (!settings.postParking) break;
        if (!state.location) break;
        await sendParkingMessage(token, channelId, state);
        break;
      }

      // All other event types are not sent to Discord
      default:
        break;
    }
  } catch (err) {
    // Belt-and-suspenders: individual handlers should never throw,
    // but swallow anything that slips through.
    console.error(
      `[discord:notifier] unexpected error event=${event.type} tid=${state.tid}:`,
      err
    );
  }
}

// ─── Round started embed ──────────────────────────────────────────────────────

export function buildRoundStartedEmbed(
  roundLabel: string,
  roundTimeMinutes: number | null,
  tournamentName: string
): DiscordEmbed {
  const label = /^\d+$/.test(roundLabel) ? `Round ${roundLabel}` : roundLabel;
  let description: string;

  if (roundTimeMinutes != null && roundTimeMinutes > 0) {
    const h = Math.floor(roundTimeMinutes / 60);
    const m = roundTimeMinutes % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m} minutes`;
    description = `⏳ Clock: **${timeStr}** on the clock`;
  } else {
    description = "Clock: untimed round";
  }

  return {
    title: `⏱️ ${label} has started!`,
    description,
    color: 0x22c55e, // Green
    footer: { text: tournamentName },
    timestamp: new Date().toISOString(),
  };
}

// ─── Final standings embed ────────────────────────────────────────────────────

export function buildFinalStandingsEmbed(
  standings: TopDeckStanding[],
  winner: TopDeckPlayer | null,
  tournamentName: string,
  topN: number
): DiscordEmbed {
  const winnerLine = winner ? `🏆 **Winner: ${winner.name}**\n\n` : "";
  const top = topN > 0 ? standings.slice(0, topN) : standings;
  const MEDALS = ["🥇", "🥈", "🥉"];

  const lines = top.map((s) => {
    const medal = s.standing <= 3 ? MEDALS[s.standing - 1] : "  ";
    const wr = (s.winRate * 100).toFixed(1);
    return `${medal} **${s.standing}.** ${s.name} — ${s.points} pts · ${wr}% WR`;
  });

  const more = standings.length - top.length;
  if (more > 0) lines.push(`*… and ${more} more player${more > 1 ? "s" : ""}*`);

  return {
    title: `🏁 ${tournamentName} — Final Results`,
    description: winnerLine + lines.join("\n"),
    color: 0xfbbf24, // Gold / amber
    footer: { text: `${standings.length} players · ${tournamentName}` },
    timestamp: new Date().toISOString(),
  };
}

// ─── Parking message ──────────────────────────────────────────────────────────

async function sendParkingMessage(
  token: string,
  channelId: string,
  state: LiveTournamentState
): Promise<void> {
  const location = state.location!;

  // Resolve coordinates — use direct lat/lng if present, otherwise geocode
  let lat = location.lat ?? null;
  let lng = location.lng ?? null;

  if (lat == null || lng == null) {
    const addr = buildAddress(location);
    if (!addr) {
      console.info(
        `[discord:notifier] parking skipped: no address for tid=${state.tid}`
      );
      return;
    }
    const point = await geocodeAddress(addr);
    if (!point) {
      console.warn(
        `[discord:notifier] parking geocode failed for tid=${state.tid}`
      );
      return;
    }
    lat = point.lat;
    lng = point.lng;
  }

  // Cache-first, provider fallback
  let results;
  const cached = await getCached(lat, lng);
  if (cached) {
    results = cached.results;
  } else {
    const provider = createParkingProvider();
    try {
      results = await provider.fetchNearby({ lat, lng });
      // Cache asynchronously — best effort, don't block the Discord send
      setCache(lat, lng, provider.name, results).catch(() => {
        /* intentionally swallowed */
      });
    } catch (err) {
      console.warn(
        `[discord:notifier] parking provider error for tid=${state.tid}:`,
        err
      );
      return;
    }
  }

  if (results.length === 0) {
    console.info(
      `[discord:notifier] parking: no results near venue for tid=${state.tid}`
    );
    return;
  }

  const embed = buildParkingEmbed(results, location, state.name);
  await sendDiscordMessage(token, channelId, { embeds: [embed] });
  console.info(
    `[discord:notifier] parking sent tid=${state.tid} results=${results.length}`
  );
}

// ─── Batch sender ─────────────────────────────────────────────────────────────

/**
 * Send a list of embeds, respecting Discord's 10-embeds-per-message cap.
 * A large pairings embed list (> 10 embeds) is split into multiple messages.
 */
async function sendEmbedBatches(
  token: string,
  channelId: string,
  embeds: DiscordEmbed[]
): Promise<void> {
  for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
    const batch = embeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE);
    await sendDiscordMessage(token, channelId, { embeds: batch });
  }
}

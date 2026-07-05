/**
 * /topdeck pairings
 *
 * Posts the latest round pairings as one or more Discord embeds.
 * For large rounds (> 4000 chars) the pairings are split into multiple embeds,
 * each covering up to 5 tables.
 */

import { getLinkByChannel } from "@/lib/discord/config-service";
import { getTournamentState } from "@/lib/topdeck/tournament-state";
import {
  InteractionResponseType,
  EPHEMERAL_FLAG,
  type DiscordInteraction,
  type InteractionResponse,
  type DiscordEmbed,
} from "@/lib/discord/types";
import type { TopDeckTable } from "@/lib/topdeck/types";

// Tables per embed when splitting large pairings
const TABLES_PER_EMBED = 5;

export async function handlePairings(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("❌ Command must be used in a channel.");

  const link = await getLinkByChannel(channelId);
  if (!link) {
    return ephemeral("❌ No tournament is linked to this channel. Use `/link <tid>` first.");
  }

  const state = await getTournamentState(link.tid);
  if (!state) {
    return ephemeral(`❌ No data found for tournament \`${link.tid}\`.`);
  }

  const activeTables = state.tables.filter((t) => t.table !== "Byes");
  if (activeTables.length === 0) {
    return ephemeral("ℹ️ No pairings published yet for the current round.");
  }

  const label = /^\d+$/.test(state.roundLabel)
    ? `Round ${state.roundLabel}`
    : state.roundLabel;

  const embeds = buildPairingsEmbeds(activeTables, label, state.name);

  // Discord allows max 10 embeds per message, but we keep it to the first batch
  const batch = embeds.slice(0, 10);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: batch },
  };
}

export function buildPairingsEmbeds(
  tables: TopDeckTable[],
  roundLabel: string,
  tournamentName: string
): DiscordEmbed[] {
  const embeds: DiscordEmbed[] = [];
  const isPod = tables.some((t) => t.players.length >= 3);

  for (let i = 0; i < tables.length; i += TABLES_PER_EMBED) {
    const chunk = tables.slice(i, i + TABLES_PER_EMBED);
    const isFirst = i === 0;

    const fields = chunk.map((t) => {
      const tableNum = t.table;
      const value = isPod
        ? t.players.map((p, idx) => `Seat ${idx + 1}: ${p.name}`).join("\n")
        : t.players.map((p) => p.name).join(" **vs** ");

      return {
        name: `Table ${tableNum}`,
        value: value || "—",
        inline: false,
      };
    });

    embeds.push({
      title: isFirst ? `🎲 ${roundLabel} Pairings` : undefined,
      description: isFirst
        ? `**${tournamentName}** · ${tables.length} table${tables.length !== 1 ? "s" : ""}`
        : undefined,
      color: isFirst ? 0x7c3aed : 0x2a2a3e,
      fields,
      timestamp: isFirst ? new Date().toISOString() : undefined,
    });
  }

  return embeds;
}

function ephemeral(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: message, flags: EPHEMERAL_FLAG },
  };
}

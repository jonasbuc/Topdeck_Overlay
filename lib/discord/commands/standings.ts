/**
 * /topdeck standings [top]
 *
 * Posts the current tournament standings as a Discord embed.
 * The optional `top` argument overrides the default topNStandings setting.
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
import type { TopDeckStanding } from "@/lib/topdeck/types";

export async function handleStandings(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("❌ Command must be used in a channel.");

  const link = await getLinkByChannel(channelId);
  if (!link) {
    return ephemeral("❌ No tournament is linked to this channel. Use `/topdeck link <tid>` first.");
  }

  const state = await getTournamentState(link.tid);
  if (!state) {
    return ephemeral(`❌ No data found for tournament \`${link.tid}\`. Waiting for the first webhook event.`);
  }

  if (state.standings.length === 0) {
    return ephemeral("ℹ️ No standings available yet — standings appear after the first round ends.");
  }

  // Determine how many to show
  const topOption = interaction.data?.options?.find((o) => o.name === "top");
  const topN =
    typeof topOption?.value === "number"
      ? topOption.value
      : link.settings.topNStandings;

  const embed = buildStandingsEmbed(
    state.standings,
    topN,
    state.name,
    state.roundLabel
  );

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: [embed] },
  };
}

export function buildStandingsEmbed(
  standings: TopDeckStanding[],
  topN: number,
  tournamentName: string,
  roundLabel: string
): DiscordEmbed {
  const top = topN > 0 ? standings.slice(0, topN) : standings;

  const MEDALS = ["🥇", "🥈", "🥉"];

  const lines = top.map((s) => {
    const medal = s.standing <= 3 ? MEDALS[s.standing - 1] : "  ";
    const wr = (s.winRate * 100).toFixed(1);
    return `${medal} **${s.standing}.** ${s.name} — ${s.points} pts · ${wr}% WR`;
  });

  const more = standings.length - top.length;
  if (more > 0) lines.push(`*… and ${more} more player${more > 1 ? "s" : ""}*`);

  const label = /^\d+$/.test(roundLabel) ? `Round ${roundLabel}` : roundLabel;

  return {
    title: `📊 Standings after ${label}`,
    description: lines.join("\n"),
    color: 0x7c3aed,
    footer: { text: tournamentName },
    timestamp: new Date().toISOString(),
  };
}

function ephemeral(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: message, flags: EPHEMERAL_FLAG },
  };
}

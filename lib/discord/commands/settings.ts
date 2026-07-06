/**
 * /topdeck settings
 *
 * Shows the current notification settings for this channel in an ephemeral
 * embed. Readable by any user; settings can be changed via /topdeck link (re-link
 * with new options) or via future admin commands.
 */

import { getLinkByChannel } from "@/lib/discord/config-service";
import {
  InteractionResponseType,
  EPHEMERAL_FLAG,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleSettings(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("❌ Command must be used in a channel.");

  const link = await getLinkByChannel(channelId);
  if (!link) {
    return ephemeral("ℹ️ No tournament is linked to this channel. Use `/topdeck link <tid>` first.");
  }

  const s = link.settings;

  const bool = (v: boolean) => (v ? "✅ On" : "❌ Off");

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "⚙️ Notification Settings",
          description: `Tournament: \`${link.tid}\``,
          color: 0x2a2a3e,
          fields: [
            { name: "Post pairings", value: bool(s.postPairings), inline: true },
            { name: "Post round started", value: bool(s.postRoundStarted), inline: true },
            { name: "Post results", value: bool(s.postResults), inline: true },
            { name: "Post standings", value: bool(s.postStandings), inline: true },
            { name: "Post parking", value: bool(s.postParking), inline: true },
            { name: "Mention players", value: bool(s.mentionPlayers), inline: true },
            {
              name: "Standings depth",
              value: s.topNStandings === 0 ? "All players" : `Top ${s.topNStandings}`,
              inline: true,
            },
          ],
          footer: { text: `Channel ${channelId}` },
        },
      ],
      flags: EPHEMERAL_FLAG,
    },
  };
}

function ephemeral(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: message, flags: EPHEMERAL_FLAG },
  };
}

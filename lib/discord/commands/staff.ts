/**
 * /topdeck staff
 *
 * Shows staff-only event links for TO, judge, producer and commentator tools.
 */

import { env } from "@/lib/env";
import { getLinkByChannel } from "@/lib/discord/config-service";
import {
  EPHEMERAL_FLAG,
  InteractionResponseType,
  hasManageChannels,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleStaffLinks(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("Command must be used in a channel.");

  const perms = interaction.member?.permissions ?? "0";
  if (!hasManageChannels(perms)) {
    return ephemeral("You need Manage Channels permission to view staff links.");
  }

  const link = await getLinkByChannel(channelId);
  if (!link) return ephemeral("No tournament is linked to this channel.");

  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const tid = link.tid;

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "TopDeck Live Staff Links",
          description: `Tournament \`${tid}\``,
          color: 0x2a2a3e,
          fields: [
            { name: "TO", value: `${baseUrl}/to/${tid}`, inline: true },
            { name: "Judge", value: `${baseUrl}/judge/${tid}`, inline: true },
            { name: "Producer", value: `${baseUrl}/producer/${tid}`, inline: true },
            { name: "Commentator", value: `${baseUrl}/commentator/${tid}`, inline: true },
          ],
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "TO", url: `${baseUrl}/to/${tid}` },
            { type: 2, style: 5, label: "Judge", url: `${baseUrl}/judge/${tid}` },
            { type: 2, style: 5, label: "Producer", url: `${baseUrl}/producer/${tid}` },
            {
              type: 2,
              style: 5,
              label: "Commentator",
              url: `${baseUrl}/commentator/${tid}`,
            },
          ],
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

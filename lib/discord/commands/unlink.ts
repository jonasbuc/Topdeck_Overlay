/**
 * /topdeck unlink
 *
 * Removes the tournament link from this channel.
 * Requires MANAGE_CHANNELS permission.
 */

import { getLinkByChannel, deleteLink } from "@/lib/discord/config-service";
import {
  hasManageChannels,
  InteractionResponseType,
  EPHEMERAL_FLAG,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleUnlink(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const perms = interaction.member?.permissions ?? "0";
  if (!hasManageChannels(perms)) {
    return ephemeral("❌ You need the **Manage Channels** permission to unlink a tournament.");
  }

  const channelId = interaction.channel_id;
  if (!channelId) {
    return ephemeral("❌ This command must be used inside a server channel.");
  }

  const link = await getLinkByChannel(channelId);
  if (!link) {
    return ephemeral("ℹ️ No tournament is currently linked to this channel.");
  }

  const removed = await deleteLink(link.tid);

  if (!removed) {
    return ephemeral("❌ Failed to remove the link. Please try again.");
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "🔗 Tournament Unlinked",
          description: `Removed the link for tournament \`${link.tid}\`. This channel will no longer receive automatic updates.`,
          color: 0x94a3b8,
        },
      ],
    },
  };
}

function ephemeral(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: message, flags: EPHEMERAL_FLAG },
  };
}

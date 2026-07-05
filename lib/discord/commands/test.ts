/**
 * /topdeck test
 *
 * Sends a test embed to verify the bot is working.
 * Requires MANAGE_CHANNELS permission (avoids spam from any user).
 */

import { getLinkByChannel } from "@/lib/discord/config-service";
import {
  hasManageChannels,
  InteractionResponseType,
  EPHEMERAL_FLAG,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleTest(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const perms = interaction.member?.permissions ?? "0";
  if (!hasManageChannels(perms)) {
    return ephemeral("❌ You need the **Manage Channels** permission to send a test message.");
  }

  const channelId = interaction.channel_id;
  const link = channelId ? await getLinkByChannel(channelId) : null;

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "🤖 TopDeck Live — Test Message",
          description:
            link
              ? `✅ Bot is working correctly.\n\nLinked tournament: \`${link.tid}\`\n\nThis channel will receive live updates when tournament webhooks arrive.`
              : `✅ Bot is working correctly.\n\nℹ️ No tournament linked yet — use \`/link <tid>\` to connect a TopDeck tournament.`,
          color: 0x22c55e,
          footer: { text: "TopDeck Live" },
          timestamp: new Date().toISOString(),
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

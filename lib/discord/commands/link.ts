/**
 * /topdeck link <tid>
 *
 * Links a TopDeck tournament to the Discord channel where the command was
 * used. Requires MANAGE_CHANNELS permission.
 *
 * Overwrites any existing link for the same tournament — the organizer can
 * re-link to move notifications to a different channel.
 */

import { saveLink } from "@/lib/discord/config-service";
import {
  hasManageChannels,
  InteractionResponseType,
  EPHEMERAL_FLAG,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleLink(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  // ── Permission check ──────────────────────────────────────────────────────
  const perms = interaction.member?.permissions ?? "0";
  if (!hasManageChannels(perms)) {
    return ephemeral("❌ You need the **Manage Channels** permission to link a tournament.");
  }

  // ── Validate required inputs ──────────────────────────────────────────────
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;

  if (!guildId || !channelId) {
    return ephemeral("❌ This command must be used inside a server channel.");
  }

  const tidOption = interaction.data?.options?.find((o) => o.name === "tid");
  const tid = typeof tidOption?.value === "string" ? tidOption.value.trim() : null;

  if (!tid) {
    return ephemeral("❌ Please provide a valid tournament ID (e.g. `tid_abc123`).");
  }

  // ── Save the link ─────────────────────────────────────────────────────────
  try {
    await saveLink(tid, guildId, channelId);
  } catch (err) {
    console.error("[discord/link] saveLink failed:", err instanceof Error ? err.message : err);
    return ephemeral("❌ Failed to save the tournament link. Please try again.");
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "✅ Tournament Linked",
          description: `This channel will now receive live updates for tournament \`${tid}\`.\n\nUse \`/topdeck standings\`, \`/topdeck pairings\`, or \`/topdeck parking\` to post on demand.\nUse \`/topdeck settings\` to view what gets posted automatically.`,
          color: 0x7c3aed, // accent purple
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

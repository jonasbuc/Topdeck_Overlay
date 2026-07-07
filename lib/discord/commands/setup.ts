/**
 * /topdeck setup [tid]
 *
 * Gives organizers an interactive setup message with useful links. If a tid is
 * provided and the user has Manage Channels, the command also links the current
 * Discord channel to that tournament.
 */

import { env } from "@/lib/env";
import {
  getLinkByChannel,
  saveLink,
} from "@/lib/discord/config-service";
import {
  EPHEMERAL_FLAG,
  hasManageChannels,
  InteractionResponseType,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

export async function handleSetup(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;

  if (!guildId || !channelId) {
    return ephemeral("Setup must be used inside a server channel.");
  }

  const tidOption = interaction.data?.options?.find((o) => o.name === "tid");
  const requestedTid =
    typeof tidOption?.value === "string" ? tidOption.value.trim() : "";

  let tid = requestedTid;
  let linkedNow = false;

  if (requestedTid) {
    const perms = interaction.member?.permissions ?? "0";
    if (!hasManageChannels(perms)) {
      return ephemeral("You need Manage Channels permission to link a tournament.");
    }
    await saveLink(requestedTid, guildId, channelId);
    linkedNow = true;
  } else {
    const existing = await getLinkByChannel(channelId);
    tid = existing?.tid ?? "";
  }

  if (!tid) {
    return ephemeral("Use `/topdeck setup tid:<tournament id>` to link this channel first.");
  }

  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const playerUrl = `${baseUrl}/event/${tid}`;
  const dashboardUrl = `${baseUrl}/dashboard/${tid}`;
  const venueUrl = `${baseUrl}/venue/${tid}`;

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: linkedNow ? "TopDeck Live setup complete" : "TopDeck Live setup",
          description:
            `Tournament \`${tid}\` is connected to this channel.\n` +
            "Use the buttons below for the player page, dashboard and venue display.",
          color: 0x7c3aed,
          fields: [
            {
              name: "Recommended next step",
              value: "Open the dashboard and configure announcements, QR sharing, judge queue and floor map.",
            },
          ],
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Player Page", url: playerUrl },
            { type: 2, style: 5, label: "Dashboard", url: dashboardUrl },
            { type: 2, style: 5, label: "Venue Display", url: venueUrl },
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

/**
 * /topdeck announce template:<template> [message]
 *
 * Posts a templated announcement to Discord and stores it for the player page
 * and venue display.
 */

import { prisma } from "@/lib/prisma";
import { getLinkByChannel } from "@/lib/discord/config-service";
import {
  EPHEMERAL_FLAG,
  InteractionResponseType,
  hasManageChannels,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";
import { serializeAnnouncement } from "@/lib/event-ops/serializers";

const TEMPLATES: Record<string, { title: string; body: string; tone: string }> = {
  "round-start": {
    title: "Round started",
    body: "Pairings are posted. Please find your table and begin your match.",
    tone: "success",
  },
  lunch: {
    title: "Lunch break",
    body: "Lunch break is active. Please watch Discord and the player page for the next round.",
    tone: "info",
  },
  topcut: {
    title: "Top cut",
    body: "Swiss rounds are complete. Top cut information will be posted shortly.",
    tone: "warning",
  },
  custom: {
    title: "Event announcement",
    body: "Please check the player page for the latest event update.",
    tone: "info",
  },
};

export async function handleAnnouncementTemplate(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("Command must be used in a channel.");

  const perms = interaction.member?.permissions ?? "0";
  if (!hasManageChannels(perms)) {
    return ephemeral("You need Manage Channels permission to post announcements.");
  }

  const link = await getLinkByChannel(channelId);
  if (!link) return ephemeral("No tournament is linked to this channel.");

  const templateOption = interaction.data?.options?.find(
    (option) => option.name === "template"
  );
  const messageOption = interaction.data?.options?.find(
    (option) => option.name === "message"
  );
  const key = typeof templateOption?.value === "string" ? templateOption.value : "custom";
  const template = TEMPLATES[key] ?? TEMPLATES.custom;
  const customMessage =
    typeof messageOption?.value === "string" ? messageOption.value.trim() : "";

  const row = await prisma.tournamentAnnouncement.create({
    data: {
      tid: link.tid,
      title: template.title,
      body: customMessage || template.body,
      tone: template.tone,
      audience: "all",
      pinned: true,
      publishedToDiscordAt: new Date(),
    },
  });
  const announcement = serializeAnnouncement(row);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: announcement.title,
          description: announcement.body,
          color:
            announcement.tone === "warning"
              ? 0xf59e0b
              : announcement.tone === "success"
              ? 0x22c55e
              : 0x7c3aed,
          footer: { text: `TopDeck Live · ${link.tid}` },
          timestamp: announcement.createdAt,
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

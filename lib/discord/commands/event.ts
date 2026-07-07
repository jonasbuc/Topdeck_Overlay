/**
 * /topdeck event [tid]
 *
 * Posts a public event hub message with buttons players can use all day.
 */

import { env } from "@/lib/env";
import { getLinkByChannel } from "@/lib/discord/config-service";
import {
  EPHEMERAL_FLAG,
  InteractionResponseType,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";
import { getTournamentState } from "@/lib/topdeck/tournament-state";

export async function handleEventHub(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const tidOption = interaction.data?.options?.find((o) => o.name === "tid");
  let tid = typeof tidOption?.value === "string" ? tidOption.value.trim() : "";

  if (!tid && interaction.channel_id) {
    const existing = await getLinkByChannel(interaction.channel_id);
    tid = existing?.tid ?? "";
  }

  if (!tid) {
    return ephemeral("Use `/topdeck event tid:<tournament id>` or link this channel first.");
  }

  const state = await getTournamentState(tid);
  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const eventUrl = `${baseUrl}/event/${tid}`;
  const recapUrl = `${baseUrl}/recap/${tid}`;

  const roundLabel =
    state?.roundLabel ||
    (state?.currentRound ? `Round ${state.currentRound}` : "Waiting");

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: state?.name || "TopDeck Live Event Hub",
          description:
            `Current status: **${state?.finished ? "Finished" : state?.status ?? "Live"}**` +
            `\nRound: **${roundLabel}**`,
          color: 0x22c55e,
          fields: [
            {
              name: "Player hub",
              value:
                "Use the buttons below for pairings, standings, table map, judge calls and the event recap.",
            },
          ],
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: "Player Hub", url: eventUrl },
            { type: 2, style: 5, label: "Pairings", url: `${eventUrl}#pairings` },
            { type: 2, style: 5, label: "Standings", url: `${eventUrl}#standings` },
            { type: 2, style: 5, label: "Venue Map", url: `${eventUrl}#floor-map` },
            { type: 2, style: 5, label: "Recap", url: recapUrl },
          ],
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

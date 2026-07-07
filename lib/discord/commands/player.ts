/**
 * /topdeck player name:<name>
 *
 * Returns a player's current table, standing and points in the linked event.
 */

import { getLinkByChannel } from "@/lib/discord/config-service";
import { getTournamentState } from "@/lib/topdeck/tournament-state";
import {
  EPHEMERAL_FLAG,
  InteractionResponseType,
  type DiscordInteraction,
  type InteractionResponse,
} from "@/lib/discord/types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function handlePlayerLookup(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("Command must be used in a channel.");

  const link = await getLinkByChannel(channelId);
  if (!link) return ephemeral("No tournament is linked to this channel.");

  const nameOption = interaction.data?.options?.find((option) => option.name === "name");
  const query = typeof nameOption?.value === "string" ? normalize(nameOption.value) : "";
  if (!query) return ephemeral("Enter a player name.");

  const state = await getTournamentState(link.tid);
  if (!state) return ephemeral(`No data found for tournament \`${link.tid}\`.`);

  const standing =
    state.standings.find((entry) => normalize(entry.name).includes(query)) ?? null;
  const table =
    state.tables.find((entry) =>
      entry.players.some((player) => normalize(player.name).includes(query))
    ) ?? null;
  const player =
    table?.players.find((entry) => normalize(entry.name).includes(query)) ??
    (standing ? { id: standing.id, name: standing.name } : null);

  if (!player) return ephemeral("Player not found in current event data.");

  const tableLabel =
    table == null ? "No active table" : table.table === "Byes" ? "Bye" : `Table ${table.table}`;
  const opponents =
    table == null
      ? "None"
      : table.players
          .filter((entry) => normalize(entry.name) !== normalize(player.name))
          .map((entry) => entry.name)
          .join(" / ") || "Bye";

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: player.name,
          description: `${tableLabel}\nOpponents: ${opponents}`,
          color: 0x22c55e,
          fields: [
            {
              name: "Standing",
              value: standing ? `#${standing.standing}` : "Pending",
              inline: true,
            },
            {
              name: "Points",
              value: standing ? String(standing.points) : "Pending",
              inline: true,
            },
            {
              name: "Round",
              value: state.roundLabel || String(state.currentRound || "Waiting"),
              inline: true,
            },
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

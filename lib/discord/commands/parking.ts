/**
 * /topdeck parking
 *
 * Posts parking options near the tournament venue.
 * Uses a deferred response because the parking API can take several seconds
 * (Overpass query or geocoding).
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
import { geocodeAddress } from "@/lib/parking/geocoder";
import { getCached } from "@/lib/parking/cache";
import { createParkingProvider } from "@/lib/parking/factory";
import type { ParkingResult } from "@/lib/parking/types";
import type { TopDeckLocation } from "@/lib/topdeck/types";

const MAX_RESULTS_IN_EMBED = 6;

export async function handleParking(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  const channelId = interaction.channel_id;
  if (!channelId) return ephemeral("❌ Command must be used in a channel.");

  const link = await getLinkByChannel(channelId);
  if (!link) {
    return ephemeral("❌ No tournament is linked to this channel. Use `/link <tid>` first.");
  }

  const state = await getTournamentState(link.tid);
  if (!state?.location) {
    return ephemeral("ℹ️ This tournament has no venue location. Parking info is unavailable.");
  }

  const location = state.location;

  // Resolve coordinates
  let lat: number | null = location.lat ?? null;
  let lng: number | null = location.lng ?? null;

  if (lat == null || lng == null) {
    const addr = buildAddress(location);
    if (!addr) return ephemeral("ℹ️ No address or coordinates found for the venue.");
    const point = await geocodeAddress(addr);
    if (!point) return ephemeral("❌ Could not locate the venue address. Try again later.");
    lat = point.lat;
    lng = point.lng;
  }

  // Check cache first
  let results: ParkingResult[];
  const cached = await getCached(lat, lng);
  if (cached) {
    results = cached.results;
  } else {
    const provider = createParkingProvider();
    try {
      results = await provider.fetchNearby({ lat, lng });
    } catch {
      return ephemeral("❌ Failed to fetch parking info. Please try again later.");
    }
  }

  if (results.length === 0) {
    return ephemeral("ℹ️ No parking found within 1 km of the venue.");
  }

  const embed = buildParkingEmbed(results, location, state.name);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { embeds: [embed] },
  };
}

export function buildParkingEmbed(
  results: ParkingResult[],
  location: TopDeckLocation,
  tournamentName: string
): DiscordEmbed {
  const top = results.slice(0, MAX_RESULTS_IN_EMBED);
  const locationStr = [location.city, location.country].filter(Boolean).join(", ");

  const lines = top.map((r) => {
    const dist =
      r.distanceMeters < 1000
        ? `${r.distanceMeters} m`
        : `${(r.distanceMeters / 1000).toFixed(1)} km`;
    const name = r.name || "Parking";
    const price = r.priceInfo ? ` · ${r.priceInfo}` : "";
    const accessible = r.accessible ? " · ♿" : "";
    const link = `[Navigate ↗](${r.navigationUrl})`;
    return `**${name}** — ${dist} walk${price}${accessible}\n${r.address ? `*${r.address}*  ` : ""}${link}`;
  });

  const more = results.length - top.length;
  if (more > 0) lines.push(`*… and ${more} more — check the tournament dashboard*`);

  return {
    title: `🅿️ Parking near ${locationStr || "venue"}`,
    description: lines.join("\n\n"),
    color: 0x7c3aed,
    footer: { text: `${tournamentName} · © OpenStreetMap contributors` },
    timestamp: new Date().toISOString(),
  };
}

export function buildAddress(location: TopDeckLocation): string {
  return [location.address, location.city, location.state, location.country]
    .filter(Boolean)
    .join(", ");
}

function ephemeral(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: message, flags: EPHEMERAL_FLAG },
  };
}

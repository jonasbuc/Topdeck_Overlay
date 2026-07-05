/**
 * Discord config service.
 *
 * Manages the DiscordLink table — which tournament is linked to which
 * Discord channel — and per-link organizer settings.
 *
 * One row per tournament (a tournament can only be linked to one channel at
 * a time). The same channel can receive multiple tournaments if the organizer
 * links them individually.
 */

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type DiscordTournamentSettings,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscordLinkRecord {
  id: string;
  tid: string;
  guildId: string;
  channelId: string;
  settings: DiscordTournamentSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get the Discord link for a tournament.
 * Returns null if the tournament has not been linked to any Discord channel.
 */
export async function getLinkByTid(
  tid: string
): Promise<DiscordLinkRecord | null> {
  const row = await prisma.discordLink.findUnique({ where: { tid } });
  if (!row) return null;
  return deserialize(row);
}

/**
 * Get the Discord link for a specific channel.
 * Returns the FIRST matching link if multiple tournaments are in one channel.
 * Used by slash commands that don't receive a tid argument.
 */
export async function getLinkByChannel(
  channelId: string
): Promise<DiscordLinkRecord | null> {
  const row = await prisma.discordLink.findFirst({ where: { channelId } });
  if (!row) return null;
  return deserialize(row);
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Link a tournament to a Discord channel.
 * If the tournament is already linked (to any channel), the existing link
 * is overwritten with the new guild/channel.
 */
export async function saveLink(
  tid: string,
  guildId: string,
  channelId: string
): Promise<DiscordLinkRecord> {
  const row = await prisma.discordLink.upsert({
    where: { tid },
    create: {
      tid,
      guildId,
      channelId,
      settings: JSON.stringify(DEFAULT_SETTINGS),
    },
    update: {
      guildId,
      channelId,
    },
  });
  return deserialize(row);
}

/**
 * Remove the Discord link for a tournament.
 * Safe to call if no link exists — returns false in that case.
 */
export async function deleteLink(tid: string): Promise<boolean> {
  try {
    await prisma.discordLink.delete({ where: { tid } });
    return true;
  } catch {
    // Row not found — already unlinked
    return false;
  }
}

/**
 * Update organizer settings for a linked tournament.
 * Merges partial settings with existing stored values (existing keys not in
 * `patch` are preserved).
 */
export async function updateSettings(
  tid: string,
  patch: Partial<DiscordTournamentSettings>
): Promise<DiscordLinkRecord | null> {
  const existing = await getLinkByTid(tid);
  if (!existing) return null;

  const merged = { ...existing.settings, ...patch };

  const row = await prisma.discordLink.update({
    where: { tid },
    data: { settings: JSON.stringify(merged) },
  });

  return deserialize(row);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PrismaLinkRow = {
  id: string;
  tid: string;
  guildId: string;
  channelId: string;
  settings: string;
  createdAt: Date;
  updatedAt: Date;
};

function deserialize(row: PrismaLinkRow): DiscordLinkRecord {
  let storedSettings: Partial<DiscordTournamentSettings> = {};
  try {
    storedSettings = JSON.parse(row.settings) as Partial<DiscordTournamentSettings>;
  } catch {
    // Corrupt settings — fall back to defaults
  }

  return {
    id: row.id,
    tid: row.tid,
    guildId: row.guildId,
    channelId: row.channelId,
    settings: mergeSettings(storedSettings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

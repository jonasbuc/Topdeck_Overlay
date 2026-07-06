/**
 * Discord setup API for a tournament.
 *
 * Used by the dashboard setup wizard. Slash commands remain the primary
 * Discord-native flow, but this route gives organizers a guided web UI for
 * linking a channel and tuning auto-post settings.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  deleteLink,
  getLinkByTid,
  saveLink,
  updateSettings,
  type DiscordLinkRecord,
} from "@/lib/discord/config-service";
import {
  DEFAULT_SETTINGS,
  type DiscordTournamentSettings,
} from "@/lib/discord/types";

export const dynamic = "force-dynamic";

type DiscordLinkResponse = {
  linked: boolean;
  link: {
    tid: string;
    guildId: string;
    channelId: string;
    settings: DiscordTournamentSettings;
    createdAt: string;
    updatedAt: string;
  } | null;
  defaults: DiscordTournamentSettings;
};

const SETTING_KEYS = new Set<keyof DiscordTournamentSettings>([
  "postPairings",
  "postRoundStarted",
  "postResults",
  "postStandings",
  "postParking",
  "topNStandings",
  "mentionPlayers",
]);

function serialize(record: DiscordLinkRecord | null): DiscordLinkResponse {
  return {
    linked: record != null,
    link: record
      ? {
          tid: record.tid,
          guildId: record.guildId,
          channelId: record.channelId,
          settings: record.settings,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        }
      : null,
    defaults: DEFAULT_SETTINGS,
  };
}

function normalizeSettingsPatch(
  value: unknown
): Partial<DiscordTournamentSettings> | null {
  if (!value || typeof value !== "object") return {};

  const input = value as Record<string, unknown>;
  const patch: Partial<DiscordTournamentSettings> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (!SETTING_KEYS.has(key as keyof DiscordTournamentSettings)) {
      return null;
    }

    if (key === "topNStandings") {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
      patch.topNStandings = Math.max(0, Math.min(64, Math.round(raw)));
      continue;
    }

    if (typeof raw !== "boolean") return null;
    switch (key) {
      case "postPairings":
        patch.postPairings = raw;
        break;
      case "postRoundStarted":
        patch.postRoundStarted = raw;
        break;
      case "postResults":
        patch.postResults = raw;
        break;
      case "postStandings":
        patch.postStandings = raw;
        break;
      case "postParking":
        patch.postParking = raw;
        break;
      case "mentionPlayers":
        patch.mentionPlayers = raw;
        break;
    }
  }

  return patch;
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  return NextResponse.json(serialize(await getLinkByTid(tid)));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const settingsPatch = normalizeSettingsPatch(body.settings);

  if (!guildId || !channelId) {
    return NextResponse.json(
      { error: "guild_channel_required" },
      { status: 400 }
    );
  }

  if (settingsPatch == null) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }

  await saveLink(tid, guildId, channelId);
  if (Object.keys(settingsPatch).length > 0) {
    await updateSettings(tid, settingsPatch);
  }

  return NextResponse.json(serialize(await getLinkByTid(tid)));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const settingsPatch = normalizeSettingsPatch(body.settings ?? body);

  if (settingsPatch == null) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }

  const updated = await updateSettings(tid, settingsPatch);
  if (!updated) {
    return NextResponse.json({ error: "not_linked" }, { status: 404 });
  }

  return NextResponse.json(serialize(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  await deleteLink(tid);
  return NextResponse.json(serialize(null));
}

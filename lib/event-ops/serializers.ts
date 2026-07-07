import type {
  JudgeCall,
  TournamentAnnouncement,
  TournamentFloorMap,
} from "@prisma/client";
import {
  normalizeAudience,
  normalizeFloorMapZones,
  normalizeJudgeStatus,
  normalizeTone,
  type JudgeCallDTO,
  type TournamentAnnouncementDTO,
  type TournamentFloorMapDTO,
} from "./types";

export function serializeAnnouncement(
  row: TournamentAnnouncement
): TournamentAnnouncementDTO {
  return {
    id: row.id,
    tid: row.tid,
    title: row.title,
    body: row.body,
    tone: normalizeTone(row.tone),
    audience: normalizeAudience(row.audience),
    pinned: row.pinned,
    publishedToDiscordAt: row.publishedToDiscordAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeJudgeCall(row: JudgeCall): JudgeCallDTO {
  return {
    id: row.id,
    tid: row.tid,
    tableNumber: row.tableNumber,
    playerName: row.playerName,
    message: row.message,
    status: normalizeJudgeStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function serializeFloorMap(
  row: TournamentFloorMap | null,
  tid: string
): TournamentFloorMapDTO {
  if (!row) {
    return {
      tid,
      title: "Venue floor map",
      zones: [],
      notes: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(row.zones);
  } catch {
    parsed = [];
  }

  return {
    tid,
    title: row.title,
    zones: normalizeFloorMapZones(parsed),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

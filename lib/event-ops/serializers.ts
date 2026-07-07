import type {
  BroadcastRunbookItem,
  ClipMarker,
  IncidentLog,
  JudgeCall,
  PlayerRequest,
  StaffAssignment,
  TournamentAnnouncement,
  TournamentFloorMap,
} from "@prisma/client";
import {
  normalizeBroadcastRunbookStatus,
  normalizeBroadcastSegment,
  normalizeAudience,
  normalizeFloorMapZones,
  normalizeIncidentCategory,
  normalizeIncidentSeverity,
  normalizeIncidentStatus,
  normalizeJudgeCategory,
  normalizeJudgePriority,
  normalizeJudgeStatus,
  normalizePlayerRequestStatus,
  normalizePlayerRequestType,
  normalizeStaffAssignmentStatus,
  normalizeStaffRole,
  normalizeTone,
  type BroadcastRunbookItemDTO,
  type ClipMarkerDTO,
  type IncidentLogDTO,
  type JudgeCallDTO,
  type PlayerRequestDTO,
  type StaffAssignmentDTO,
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
    category: normalizeJudgeCategory(row.category),
    priority: normalizeJudgePriority(row.priority),
    assignedTo: row.assignedTo,
    internalNote: row.internalNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
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

export function serializePlayerRequest(row: PlayerRequest): PlayerRequestDTO {
  return {
    id: row.id,
    tid: row.tid,
    type: normalizePlayerRequestType(row.type),
    playerName: row.playerName,
    tableNumber: row.tableNumber,
    message: row.message,
    status: normalizePlayerRequestStatus(row.status),
    priority: normalizeJudgePriority(row.priority),
    assignedTo: row.assignedTo,
    internalNote: row.internalNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function serializeStaffAssignment(
  row: StaffAssignment
): StaffAssignmentDTO {
  return {
    id: row.id,
    tid: row.tid,
    staffName: row.staffName,
    role: normalizeStaffRole(row.role),
    zone: row.zone,
    tableNumber: row.tableNumber,
    status: normalizeStaffAssignmentStatus(row.status),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeIncidentLog(row: IncidentLog): IncidentLogDTO {
  return {
    id: row.id,
    tid: row.tid,
    playerName: row.playerName,
    tableNumber: row.tableNumber,
    category: normalizeIncidentCategory(row.category),
    severity: normalizeIncidentSeverity(row.severity),
    summary: row.summary,
    ruling: row.ruling,
    appealed: row.appealed,
    status: normalizeIncidentStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeBroadcastRunbookItem(
  row: BroadcastRunbookItem
): BroadcastRunbookItemDTO {
  return {
    id: row.id,
    tid: row.tid,
    segment: normalizeBroadcastSegment(row.segment),
    title: row.title,
    body: row.body,
    status: normalizeBroadcastRunbookStatus(row.status),
    featureTable: row.featureTable,
    lowerThird: row.lowerThird,
    sponsorLine: row.sponsorLine,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeClipMarker(row: ClipMarker): ClipMarkerDTO {
  return {
    id: row.id,
    tid: row.tid,
    label: row.label,
    note: row.note,
    roundLabel: row.roundLabel,
    tableNumber: row.tableNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

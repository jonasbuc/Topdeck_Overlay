/**
 * Event operations types.
 *
 * These are organizer-created, tournament-day objects that live outside the
 * TopDeck webhook stream: announcements, judge/help calls and floor-map zones.
 */

export type AnnouncementTone = "info" | "success" | "warning" | "urgent";
export type AnnouncementAudience = "all" | "players" | "venue" | "discord";

export interface TournamentAnnouncementDTO {
  id: string;
  tid: string;
  title: string;
  body: string;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  pinned: boolean;
  publishedToDiscordAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JudgeCallStatus = "open" | "acknowledged" | "resolved";
export type JudgeCallCategory =
  | "rules"
  | "deck_check"
  | "missing_player"
  | "result_issue"
  | "logistics"
  | "other";
export type JudgeCallPriority = "low" | "normal" | "high" | "urgent";

export interface JudgeCallDTO {
  id: string;
  tid: string;
  tableNumber: string | null;
  playerName: string | null;
  message: string | null;
  status: JudgeCallStatus;
  category: JudgeCallCategory;
  priority: JudgeCallPriority;
  assignedTo: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface FloorMapZone {
  id: string;
  label: string;
  tableStart: number;
  tableEnd: number;
  detail?: string;
}

export interface TournamentFloorMapDTO {
  tid: string;
  title: string;
  zones: FloorMapZone[];
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PlayerRequestType =
  | "lost_item"
  | "water"
  | "accessibility"
  | "drop"
  | "help";
export type PlayerRequestStatus = "open" | "acknowledged" | "resolved";

export interface PlayerRequestDTO {
  id: string;
  tid: string;
  type: PlayerRequestType;
  playerName: string | null;
  tableNumber: string | null;
  message: string | null;
  status: PlayerRequestStatus;
  priority: JudgeCallPriority;
  assignedTo: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export type StaffRole =
  | "head_judge"
  | "floor_judge"
  | "scorekeeper"
  | "coverage"
  | "runner"
  | "TO";
export type StaffAssignmentStatus = "active" | "break" | "offline";

export interface StaffAssignmentDTO {
  id: string;
  tid: string;
  staffName: string;
  role: StaffRole;
  zone: string | null;
  tableNumber: string | null;
  status: StaffAssignmentStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IncidentCategory =
  | "penalty"
  | "appeal"
  | "slow_play"
  | "deck_issue"
  | "conduct"
  | "other";
export type IncidentSeverity =
  | "note"
  | "warning"
  | "game_loss"
  | "match_loss"
  | "disqualification";
export type IncidentStatus = "open" | "closed";

export interface IncidentLogDTO {
  id: string;
  tid: string;
  playerName: string | null;
  tableNumber: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  ruling: string | null;
  appealed: boolean;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
}

export type BroadcastSegment =
  | "pre_round"
  | "round"
  | "break"
  | "top_cut"
  | "finals"
  | "sponsor"
  | "custom";
export type BroadcastRunbookStatus = "queued" | "live" | "done";

export interface BroadcastRunbookItemDTO {
  id: string;
  tid: string;
  segment: BroadcastSegment;
  title: string;
  body: string | null;
  status: BroadcastRunbookStatus;
  featureTable: string | null;
  lowerThird: string | null;
  sponsorLine: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClipMarkerDTO {
  id: string;
  tid: string;
  label: string;
  note: string | null;
  roundLabel: string | null;
  tableNumber: string | null;
  createdAt: string;
}

export const ANNOUNCEMENT_TONES: AnnouncementTone[] = [
  "info",
  "success",
  "warning",
  "urgent",
];

export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = [
  "all",
  "players",
  "venue",
  "discord",
];

export const JUDGE_CALL_STATUSES: JudgeCallStatus[] = [
  "open",
  "acknowledged",
  "resolved",
];

export const JUDGE_CALL_CATEGORIES: JudgeCallCategory[] = [
  "rules",
  "deck_check",
  "missing_player",
  "result_issue",
  "logistics",
  "other",
];

export const JUDGE_CALL_PRIORITIES: JudgeCallPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export const PLAYER_REQUEST_TYPES: PlayerRequestType[] = [
  "lost_item",
  "water",
  "accessibility",
  "drop",
  "help",
];

export const PLAYER_REQUEST_STATUSES: PlayerRequestStatus[] = [
  "open",
  "acknowledged",
  "resolved",
];

export const STAFF_ROLES: StaffRole[] = [
  "head_judge",
  "floor_judge",
  "scorekeeper",
  "coverage",
  "runner",
  "TO",
];

export const STAFF_ASSIGNMENT_STATUSES: StaffAssignmentStatus[] = [
  "active",
  "break",
  "offline",
];

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  "penalty",
  "appeal",
  "slow_play",
  "deck_issue",
  "conduct",
  "other",
];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "note",
  "warning",
  "game_loss",
  "match_loss",
  "disqualification",
];

export const INCIDENT_STATUSES: IncidentStatus[] = ["open", "closed"];

export const BROADCAST_SEGMENTS: BroadcastSegment[] = [
  "pre_round",
  "round",
  "break",
  "top_cut",
  "finals",
  "sponsor",
  "custom",
];

export const BROADCAST_RUNBOOK_STATUSES: BroadcastRunbookStatus[] = [
  "queued",
  "live",
  "done",
];

export function normalizeTone(value: unknown): AnnouncementTone {
  return ANNOUNCEMENT_TONES.includes(value as AnnouncementTone)
    ? (value as AnnouncementTone)
    : "info";
}

export function normalizeAudience(value: unknown): AnnouncementAudience {
  return ANNOUNCEMENT_AUDIENCES.includes(value as AnnouncementAudience)
    ? (value as AnnouncementAudience)
    : "all";
}

export function normalizeJudgeStatus(value: unknown): JudgeCallStatus {
  return JUDGE_CALL_STATUSES.includes(value as JudgeCallStatus)
    ? (value as JudgeCallStatus)
    : "open";
}

export function normalizeJudgeCategory(value: unknown): JudgeCallCategory {
  return JUDGE_CALL_CATEGORIES.includes(value as JudgeCallCategory)
    ? (value as JudgeCallCategory)
    : "rules";
}

export function normalizeJudgePriority(value: unknown): JudgeCallPriority {
  return JUDGE_CALL_PRIORITIES.includes(value as JudgeCallPriority)
    ? (value as JudgeCallPriority)
    : "normal";
}

export function normalizePlayerRequestType(value: unknown): PlayerRequestType {
  return PLAYER_REQUEST_TYPES.includes(value as PlayerRequestType)
    ? (value as PlayerRequestType)
    : "help";
}

export function normalizePlayerRequestStatus(value: unknown): PlayerRequestStatus {
  return PLAYER_REQUEST_STATUSES.includes(value as PlayerRequestStatus)
    ? (value as PlayerRequestStatus)
    : "open";
}

export function normalizeStaffRole(value: unknown): StaffRole {
  return STAFF_ROLES.includes(value as StaffRole) ? (value as StaffRole) : "floor_judge";
}

export function normalizeStaffAssignmentStatus(
  value: unknown
): StaffAssignmentStatus {
  return STAFF_ASSIGNMENT_STATUSES.includes(value as StaffAssignmentStatus)
    ? (value as StaffAssignmentStatus)
    : "active";
}

export function normalizeIncidentCategory(value: unknown): IncidentCategory {
  return INCIDENT_CATEGORIES.includes(value as IncidentCategory)
    ? (value as IncidentCategory)
    : "other";
}

export function normalizeIncidentSeverity(value: unknown): IncidentSeverity {
  return INCIDENT_SEVERITIES.includes(value as IncidentSeverity)
    ? (value as IncidentSeverity)
    : "note";
}

export function normalizeIncidentStatus(value: unknown): IncidentStatus {
  return INCIDENT_STATUSES.includes(value as IncidentStatus)
    ? (value as IncidentStatus)
    : "open";
}

export function normalizeBroadcastSegment(value: unknown): BroadcastSegment {
  return BROADCAST_SEGMENTS.includes(value as BroadcastSegment)
    ? (value as BroadcastSegment)
    : "round";
}

export function normalizeBroadcastRunbookStatus(
  value: unknown
): BroadcastRunbookStatus {
  return BROADCAST_RUNBOOK_STATUSES.includes(value as BroadcastRunbookStatus)
    ? (value as BroadcastRunbookStatus)
    : "queued";
}

export function normalizeFloorMapZones(value: unknown): FloorMapZone[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index): FloorMapZone | null => {
      if (!raw || typeof raw !== "object") return null;
      const zone = raw as Record<string, unknown>;
      const label = typeof zone.label === "string" ? zone.label.trim() : "";
      const tableStart = Number(zone.tableStart);
      const tableEnd = Number(zone.tableEnd);

      if (!label || !Number.isFinite(tableStart) || !Number.isFinite(tableEnd)) {
        return null;
      }

      const start = Math.max(1, Math.round(Math.min(tableStart, tableEnd)));
      const end = Math.max(start, Math.round(Math.max(tableStart, tableEnd)));

      return {
        id:
          typeof zone.id === "string" && zone.id.trim()
            ? zone.id.trim()
            : `zone-${index + 1}`,
        label,
        tableStart: start,
        tableEnd: end,
        detail:
          typeof zone.detail === "string" && zone.detail.trim()
            ? zone.detail.trim()
            : undefined,
      };
    })
    .filter((zone): zone is FloorMapZone => zone != null);
}

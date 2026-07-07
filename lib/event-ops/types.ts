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

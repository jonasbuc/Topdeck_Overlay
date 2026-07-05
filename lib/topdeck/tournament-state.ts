/**
 * Tournament state service.
 *
 * Reads and writes the `TournamentState` table via Prisma.
 *
 * Design decisions:
 * - JSON blobs (tables, standings, etc.) are stored as strings and
 *   deserialized here so callers always work with typed objects.
 * - Unix millisecond timestamps are stored as strings in SQLite
 *   (SQLite integers cap at 32-bit by default in some drivers).
 * - The `winner` field in LiveTournamentState (TopDeckPlayer | null) is
 *   stored as `winnerData` (JSON string) in the DB to avoid collision with
 *   the old winner (string) field.
 */

import { prisma } from "@/lib/prisma";
import type {
  LiveTournamentState,
  TopDeckTable,
  MatchResultEntry,
  TopDeckStanding,
  TopDeckPlayer,
  DroppedPlayerEntry,
  TopDeckAttendee,
  TopDeckLocation,
  TopDeckTournamentStatus,
  RoundSnapshot,
} from "@/lib/topdeck/types";

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Returns the current live state for a tournament, or null if unknown. */
export async function getTournamentState(
  tid: string
): Promise<LiveTournamentState | null> {
  const row = await prisma.tournamentState.findUnique({ where: { tid } });
  if (!row) return null;
  return deserialize(row as unknown as PrismaRow);
}

// ─── Summary type (used by /api/tournaments listing) ─────────────────────────

export interface TournamentSummary {
  tid: string;
  name: string;
  game: string;
  format: string;
  status: TopDeckTournamentStatus;
  /** Unix ms. null until REST enrichment runs. */
  startDate: number | null;
  participantCount: number | null;
  finished: boolean;
  updatedAt: string;
}

/**
 * Returns a lightweight summary of every known tournament in the DB,
 * newest first by DB updatedAt.
 */
export async function listTournamentStates(limit = 50): Promise<TournamentSummary[]> {
  const rows = await prisma.tournamentState.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      tid: true,
      name: true,
      game: true,
      format: true,
      status: true,
      startDate: true,
      participantCount: true,
      finished: true,
      updatedAt: true,
    },
  });

  type SummaryRow = (typeof rows)[number];

  return rows.map((r: SummaryRow): TournamentSummary => ({
    tid: r.tid,
    name: r.name,
    game: r.game,
    format: r.format,
    status: r.status as TopDeckTournamentStatus,
    startDate: r.startDate ? parseInt(r.startDate, 10) : null,
    participantCount: r.participantCount,
    finished: r.finished,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Apply a partial update to a tournament's state.
 *
 * Uses upsert so the first event for a new `tid` creates the row.
 * JSON fields and unix-ms fields are serialized automatically.
 */
export async function patchTournamentState(
  tid: string,
  patch: Partial<Omit<LiveTournamentState, "tid" | "updatedAt">>
): Promise<LiveTournamentState> {
  const serialized = serializePatch(patch);

  const row = await prisma.tournamentState.upsert({
    where: { tid },
    create: { tid, ...serialized },
    update: serialized,
  });

  return deserialize(row as unknown as PrismaRow);
}

// ─── Serialization helpers ────────────────────────────────────────────────────

type PrismaRow = {
  tid: string;
  name: string;
  game: string;
  format: string;
  startDate: string | null;
  status: string;
  location: string | null;
  headerImage: string | null;
  currentStage: number;
  currentRound: number;
  roundLabel: string;
  roundStatus: string;
  roundStartedAt: string | null;
  roundTimeMinutes: number | null;
  tables: string;
  matchResults: string;
  standings: string;
  players: string;
  droppedPlayers: string;
  waitlistPlayers: string;
  roundHistory: string | undefined; // undefined until db push adds the column
  checkinStarted: boolean;
  checkinStage: number | null;
  finished: boolean;
  finishedAt: string | null;
  winnerData: string | null;
  participantCount: number | null;
  lastEventId: string;
  lastEventCreated: string;
  updatedAt: Date;
};

function deserialize(row: PrismaRow): LiveTournamentState {
  return {
    tid: row.tid,
    name: row.name,
    game: row.game,
    format: row.format,
    startDate: row.startDate ? parseInt(row.startDate, 10) : null,
    status: row.status as TopDeckTournamentStatus,
    location: row.location ? (JSON.parse(row.location) as TopDeckLocation) : null,
    headerImage: row.headerImage ?? null,
    currentStage: row.currentStage,
    currentRound: row.currentRound,
    roundLabel: row.roundLabel,
    roundStatus: row.roundStatus as "pending" | "active" | "ended",
    roundStartedAt: row.roundStartedAt ? parseInt(row.roundStartedAt, 10) : null,
    roundTimeMinutes: row.roundTimeMinutes ?? null,
    tables: JSON.parse(row.tables) as TopDeckTable[],
    matchResults: JSON.parse(row.matchResults) as MatchResultEntry[],
    standings: JSON.parse(row.standings) as TopDeckStanding[],
    players: JSON.parse(row.players) as TopDeckPlayer[],
    droppedPlayers: JSON.parse(row.droppedPlayers) as DroppedPlayerEntry[],
    waitlistPlayers: JSON.parse(row.waitlistPlayers) as TopDeckAttendee[],
    roundHistory: JSON.parse(row.roundHistory ?? "[]") as RoundSnapshot[],
    checkinStarted: row.checkinStarted,
    checkinStage: row.checkinStage ?? null,
    finished: row.finished,
    finishedAt: row.finishedAt ? parseInt(row.finishedAt, 10) : null,
    winner: row.winnerData ? (JSON.parse(row.winnerData) as TopDeckPlayer) : null,
    participantCount: row.participantCount ?? null,
    lastEventId: row.lastEventId,
    lastEventCreated: parseInt(row.lastEventCreated, 10),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePatch(
  patch: Partial<Omit<LiveTournamentState, "tid" | "updatedAt">>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      // JSON blobs
      case "tables":
      case "matchResults":
      case "standings":
      case "players":
      case "droppedPlayers":
      case "waitlistPlayers":
      case "roundHistory":
      case "location":
        result[key] = JSON.stringify(value);
        break;

      // winner is stored as winnerData (JSON) in the DB
      case "winner":
        result["winnerData"] = value != null ? JSON.stringify(value) : null;
        break;

      // Unix ms stored as strings
      case "roundStartedAt":
      case "startDate":
      case "finishedAt":
        result[key] = value != null ? String(value) : null;
        break;

      case "lastEventCreated":
        result[key] = String(value);
        break;

      default:
        result[key] = value;
    }
  }

  return result;
}

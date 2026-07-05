/**
 * TypeScript types for the TopDeck.gg webhook and REST APIs.
 *
 * Aligned to the official TopDeck.gg API documentation, version 2026-07.
 *   Webhooks:  https://topdeck.gg/docs/webhooks
 *   REST API:  https://topdeck.gg/docs/tournaments-v2
 *
 * Key differences from guessed types (DO NOT regress):
 *   - event.created is a Unix millisecond integer, NOT an ISO string
 *   - event.tid / event.tournament are null for ping events
 *   - Data payloads use stage/round/tables, NOT roundNumber/pairings
 *   - round.started uses startedAt(ms) + roundTimeMinutes, NOT timerStartedAt + roundLengthSeconds
 *   - Standings use { standing, name, id, winRate, opponentWinRate }, NOT { rank, player{}, wins, losses }
 *   - match.result_reported has a result type string + table snapshot, NOT a pairing with winnerIndex
 *   - player.dropped includes droppedInRound, NOT just player name
 */

// ─── Event type discriminator ────────────────────────────────────────────────

export type TopDeckEventType =
  | "ping"
  | "tournament.checkin_started"
  | "round.published"
  | "round.started"
  | "match.result_reported"
  | "round.ended"
  | "player.registered"
  | "player.dropped"
  | "tournament.finished";

// ─── Core shared types ───────────────────────────────────────────────────────

/**
 * A player as they appear in tables, player events, and standings.
 *
 * `id` is the TopDeck user ID for registered players, or a generated ID for
 * organizer-added players without a TopDeck account.
 */
export interface TopDeckPlayer {
  id: string;
  name: string;
  /** Present on events with Discord integration */
  discord?: string;
  discordId?: string;
  /** Team events only: per-seat format tag */
  teamTag?: string;
}

/**
 * A table (match) within a round, as returned by the REST API and webhooks.
 *
 * `table` is a number for normal tables, or the string "Byes" for the bye row.
 * `winner_id` is the string "Draw" for drawn matches.
 * `winner_games` / `loser_games` are only populated for 1v1 (Pairs) matches.
 */
export interface TopDeckTable {
  table: number | "Byes";
  players: TopDeckPlayer[];
  winner: string | null;
  winner_id: string | "Draw" | null;
  /** Games won by the match winner. Null for multiplayer, draws, or unfinished. */
  winner_games: number | null;
  /** Games won by the loser. Same null conditions as winner_games. */
  loser_games: number | null;
  status: "Completed" | "Active" | "Pending" | "Bye";
  /** Team events only: groups per-seat sub-tables of one team pairing. */
  match?: string;
}

/**
 * A standings entry as returned by round.ended, tournament.finished,
 * and the REST standings endpoint.
 *
 * Does NOT include wins/losses/draws counts — only points and win rates.
 * Decklists are excluded from webhook payloads; fetch the REST API for those.
 */
export interface TopDeckStanding {
  standing: number;
  name: string;
  id: string;
  points: number;
  winRate: number;
  opponentWinRate: number;
  /** League tournaments use successRate instead of winRate */
  successRate?: number;
  opponentSuccessRate?: number;
  /** Pairs mode only */
  gameWinRate?: number;
  opponentGameWinRate?: number;
  /** Only when tournament ended or organizer enabled Show Decks */
  decklist?: string | null;
  deckObj?: Record<string, unknown> | null;
}

/**
 * The tournament summary embedded in every non-ping webhook envelope.
 * Contains only name, game, and format — NOT tid (that is the top-level field).
 */
export interface TopDeckTournamentSummary {
  name: string;
  game: string;
  format: string;
}

// ─── Event-specific data payloads ────────────────────────────────────────────

export interface TopDeckPingData {
  message?: string;
}

export interface TopDeckCheckinStartedData {
  /** The stage number check-in was started for. */
  stage: number;
}

export interface TopDeckRoundPublishedData {
  stage: number;
  round: number;
  /** Display label: the round number for Swiss, or "Top 4"-style strings for bracket. */
  roundLabel: number | string;
  tables: TopDeckTable[];
}

export interface TopDeckRoundStartedData {
  stage: number;
  round: number;
  roundLabel: number | string;
  /** Round start time as Unix milliseconds. Null if no timer is used. */
  startedAt: number | null;
  /** Configured round length in minutes. Null if no timer configured. */
  roundTimeMinutes: number | null;
}

/** What kind of result update happened on a table. */
export type TopDeckMatchResultType =
  | "winner"   // a winner or points were set
  | "wld"      // best-of win/loss/draw counts were set
  | "loss"     // a pod player was marked eliminated
  | "unloss"   // a pod player was unmarked as eliminated
  | "reset";   // the result was cleared

export interface TopDeckMatchResultReportedData {
  stage: number;
  /** Round number (integer) or bracket auto-round label (e.g. "active"). */
  round: number | string;
  result: TopDeckMatchResultType;
  /**
   * Snapshot of the table AFTER the report. May be null on a reset.
   *
   * IMPORTANT: Under rapid corrections an earlier `event.created` can carry
   * a later snapshot. Always treat the latest `created` as authoritative,
   * or refetch from the REST API if exact current state matters.
   */
  table: TopDeckTable | null;
}

export interface TopDeckRoundEndedData {
  stage: number;
  round: number;
  roundLabel: number | string;
  /** All players in standings order. No decklists. */
  standings: TopDeckStanding[];
}

export interface TopDeckPlayerRegisteredData {
  player: TopDeckPlayer;
  /** Registration time as Unix milliseconds. */
  registeredAt: number;
}

export interface TopDeckPlayerDroppedData {
  player: TopDeckPlayer;
  /** The round after which the drop takes effect. */
  droppedInRound: number;
}

export interface TopDeckTournamentFinishedData {
  /** Unix milliseconds, or null. */
  endedAt: number | null;
  participantCount: number | null;
  winner: TopDeckPlayer | null;
  /** Full final standings. No decklists. */
  standings: TopDeckStanding[];
}

// ─── Webhook envelope ─────────────────────────────────────────────────────────

/**
 * Every TopDeck webhook delivery has this shape at the top level.
 *
 * Critical: `tid` and `tournament` are null for `ping` events.
 * Critical: `created` is a Unix millisecond integer, NOT an ISO string.
 */
interface BaseEnvelope<T extends TopDeckEventType, D> {
  /** Unique event ID (evt_…). Deduplicate on this field. */
  id: string;
  type: T;
  /** When the event occurred — Unix milliseconds. */
  created: number;
  /** Currently "2026-07". */
  apiVersion: string;
  /** Tournament ID. null for ping events. */
  tid: string | null;
  /** Tournament summary. null for ping events. */
  tournament: TopDeckTournamentSummary | null;
  data: D;
}

export type TopDeckPingEvent            = BaseEnvelope<"ping",                       TopDeckPingData>;
export type TopDeckCheckinStartedEvent  = BaseEnvelope<"tournament.checkin_started", TopDeckCheckinStartedData>;
export type TopDeckRoundPublishedEvent  = BaseEnvelope<"round.published",            TopDeckRoundPublishedData>;
export type TopDeckRoundStartedEvent    = BaseEnvelope<"round.started",              TopDeckRoundStartedData>;
export type TopDeckMatchResultEvent     = BaseEnvelope<"match.result_reported",      TopDeckMatchResultReportedData>;
export type TopDeckRoundEndedEvent      = BaseEnvelope<"round.ended",                TopDeckRoundEndedData>;
export type TopDeckTournamentFinished   = BaseEnvelope<"tournament.finished",        TopDeckTournamentFinishedData>;
export type TopDeckPlayerRegistered     = BaseEnvelope<"player.registered",          TopDeckPlayerRegisteredData>;
export type TopDeckPlayerDropped        = BaseEnvelope<"player.dropped",             TopDeckPlayerDroppedData>;

/** Discriminated union of every possible TopDeck webhook event. */
export type TopDeckWebhookEvent =
  | TopDeckPingEvent
  | TopDeckCheckinStartedEvent
  | TopDeckRoundPublishedEvent
  | TopDeckRoundStartedEvent
  | TopDeckMatchResultEvent
  | TopDeckRoundEndedEvent
  | TopDeckTournamentFinished
  | TopDeckPlayerRegistered
  | TopDeckPlayerDropped;

// ─── REST API response types ──────────────────────────────────────────────────

export type TopDeckTournamentStatus = "Not Started" | "Ongoing" | "Complete";

export interface TopDeckLocation {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

/** GET /v2/tournaments/{TID}/info */
export interface TopDeckTournamentInfo {
  tid: string;
  name: string;
  game: string;
  format: string;
  startDate: number;
  endDate: number | null;
  status: TopDeckTournamentStatus;
  location: TopDeckLocation | null;
  headerImage: string | null;
}

/** Entry from GET /v2/me/tournaments */
export interface TopDeckMyTournament extends TopDeckTournamentInfo {
  registeredCount: number | null;
  capacity: number | null;
}

/** GET /v2/tournaments/{TID}/players/{ID} */
export interface TopDeckPlayerDetail {
  name: string;
  standing: number;
  decklist: string | null;
  deckObj: Record<string, unknown> | null;
  winRate: number;
  gamesPlayed: number;
  gamesWon: number;
  byes: number;
  gamesDrawn: number;
  gamesLost: number;
}

/** Entry from GET /v2/tournaments/{TID}/attendees (staff only, judge role+) */
export interface TopDeckAttendee {
  uid: string | null;
  name: string;
  email: string | null;
  discord: string | null;
  discordId: string | null;
  status: "player" | "dropped" | "waitlist";
  standing: number | null;
  decklist: string | null;
  deckObj: Record<string, unknown> | null;
  joinedAt?: number | null;
  waitlistStatus?: "waiting" | "offered" | "accepted" | "declined" | "expired";
  waitlistPosition?: number | null;
  offeredAt?: number | null;
  expirationTimestamp?: number | null;
}

// ─── Application-level derived types ─────────────────────────────────────────

/** An entry in the live match results feed (application-level, not a TopDeck type). */
export interface MatchResultEntry {
  stage: number;
  round: number | string;
  tableNumber: number | "Byes";
  table: TopDeckTable;
  result: TopDeckMatchResultType;
  /** Unix milliseconds (event.created) when this result was received. */
  reportedAt: number;
}

/** A dropped player with round context (application-level). */
export interface DroppedPlayerEntry {
  player: TopDeckPlayer;
  droppedInRound: number;
}

/** Snapshot of a completed round, stored in roundHistory. */
export interface RoundSnapshot {
  stage: number;
  round: number;
  roundLabel: string;
  /** Table pairings as they were when the round ended. */
  tables: TopDeckTable[];
  /** End-of-round standings. */
  standings: TopDeckStanding[];
  /** Unix ms when round.ended was processed. */
  endedAt: number;
}

// ─── Derived tournament state (used in frontend + SSE) ────────────────────────

export interface LiveTournamentState {
  tid: string;
  name: string;
  game: string;
  format: string;

  // Enriched by REST API (null until fetched)
  startDate: number | null;
  status: TopDeckTournamentStatus;
  location: TopDeckLocation | null;
  headerImage: string | null;

  // Stage / round
  currentStage: number;
  currentRound: number;
  roundLabel: string;
  roundStatus: "pending" | "active" | "ended";
  /** Round start time as Unix milliseconds. null until round.started fires. */
  roundStartedAt: number | null;
  /** Round length in minutes. null if no timer configured. */
  roundTimeMinutes: number | null;

  // Live data (from webhooks)
  tables: TopDeckTable[];
  matchResults: MatchResultEntry[];
  standings: TopDeckStanding[];
  players: TopDeckPlayer[];
  droppedPlayers: DroppedPlayerEntry[];
  /** Populated only via REST API attendees endpoint (staff role required). */
  waitlistPlayers: TopDeckAttendee[];
  /** Completed rounds archive, appended on each round.ended event. */
  roundHistory: RoundSnapshot[];

  // Check-in
  checkinStarted: boolean;
  checkinStage: number | null;

  // Finish state
  finished: boolean;
  finishedAt: number | null;
  winner: TopDeckPlayer | null;
  participantCount: number | null;

  // Event tracking — both used for conflict resolution
  lastEventId: string;
  /** Unix ms of the most recently applied event. Used to reject stale events. */
  lastEventCreated: number;

  updatedAt: string; // ISO string (from DB updatedAt)
}

/**
 * Discord integration — shared types.
 *
 * These types describe the configuration stored per tournament in the
 * DiscordLink.settings JSON column, plus some helpers used across the
 * Discord command handlers and notifier.
 */

// ─── Tournament settings ──────────────────────────────────────────────────────

/**
 * Organizer-configurable settings for a linked Discord tournament.
 * Stored as JSON in DiscordLink.settings.
 *
 * All fields have sensible defaults — a newly linked tournament gets the
 * DEFAULT_SETTINGS below until an organizer changes them.
 */
export interface DiscordTournamentSettings {
  /**
   * Post a pairings embed when `round.published` fires.
   * @default true
   */
  postPairings: boolean;

  /**
   * Post a round-started embed (with timer) when `round.started` fires.
   * @default true
   */
  postRoundStarted: boolean;

  /**
   * Post a result embed when `match.result_reported` fires.
   * Off by default — large tournaments produce many result events and can
   * flood the channel. Organizers can opt in explicitly.
   * @default false
   */
  postResults: boolean;

  /**
   * Post a top-N standings embed when `round.ended` fires.
   * @default true
   */
  postStandings: boolean;

  /**
   * Post venue + parking info when `tournament.checkin_started` fires
   * (if the tournament has a location).
   * @default true
   */
  postParking: boolean;

  /**
   * How many players to show in standings embeds.
   * Use 0 to show all players.
   * @default 8
   */
  topNStandings: number;

  /**
   * Attempt to @mention players by Discord handle when their TopDeck
   * profile has a discord field. Requires players to be registered with
   * their Discord handle on TopDeck.
   * @default false
   */
  mentionPlayers: boolean;
}

export const DEFAULT_SETTINGS: DiscordTournamentSettings = {
  postPairings: true,
  postRoundStarted: true,
  postResults: false,
  postStandings: true,
  postParking: true,
  topNStandings: 8,
  mentionPlayers: false,
};

/**
 * Merge partial settings with the defaults.
 * Used when reading settings from the DB — unknown/missing keys fall back
 * to defaults so new settings added in future versions work immediately.
 */
export function mergeSettings(
  stored: Partial<DiscordTournamentSettings>
): DiscordTournamentSettings {
  return { ...DEFAULT_SETTINGS, ...stored };
}

// ─── Interaction types (discord-api-types subset) ────────────────────────────

/**
 * Minimal typing for the Discord interaction payload we receive at
 * POST /api/discord/interactions.
 *
 * We use discord-api-types for the authoritative shape but define this
 * lightweight subset for use in command handlers so they don't need to
 * import the full discord-api-types package.
 */
export interface DiscordInteraction {
  /** Interaction type: 1=PING, 2=APPLICATION_COMMAND, 3=MESSAGE_COMPONENT */
  type: number;
  /** Unique interaction ID */
  id: string;
  /** Application ID */
  application_id: string;
  /** Guild the interaction was sent from (null for DMs) */
  guild_id?: string;
  /** Channel the interaction was sent from */
  channel_id?: string;
  /** Member who triggered the interaction (guild) */
  member?: {
    user: { id: string; username: string };
    permissions: string;
  };
  /** User who triggered the interaction (DM) */
  user?: { id: string; username: string };
  /** Interaction token (for followup messages) */
  token: string;
  /** Resolved command data for APPLICATION_COMMAND type */
  data?: {
    id: string;
    name: string;
    options?: DiscordInteractionOption[];
  };
}

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
}

// ─── Interaction response types ───────────────────────────────────────────────

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordActionRow[];
    /** Ephemeral messages are only visible to the command invoker */
    flags?: number;
  };
}

export interface DiscordActionRow {
  type: 1;
  components: DiscordButton[];
}

export interface DiscordButton {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label: string;
  custom_id?: string;
  url?: string;
}

/** Discord message flag: only the invoking user sees it */
export const EPHEMERAL_FLAG = 64;

// ─── Discord permission bits (partial) ───────────────────────────────────────

/**
 * Returns true if the permissions string (from member.permissions) includes
 * the MANAGE_CHANNELS permission bit (bit position 4 = decimal 16).
 *
 * Uses BigInt via the Function constructor to avoid a compile-time BigInt
 * literal error on ES2017 targets while still handling 64-bit Discord perms
 * at runtime (Node.js supports BigInt regardless of tsconfig target).
 */
export function hasManageChannels(permissionsString: string): boolean {
  try {
    // Evaluate at runtime — avoids ES2017 BigInt literal restriction at compile time
    const perms = BigInt(permissionsString);
    const manageChannelsBit = BigInt(16); // 1 << 4
    return (perms & manageChannelsBit) === manageChannelsBit;
  } catch {
    return false;
  }
}

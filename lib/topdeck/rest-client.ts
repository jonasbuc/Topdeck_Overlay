/**
 * TopDeck REST API v2 client.
 *
 * Base URL: https://topdeck.gg/api/v2
 * Auth:     Authorization: <TOPDECK_API_KEY>
 *
 * All methods throw `TopDeckApiError` on non-2xx responses.
 * Pass an optional `signal` to any method for request cancellation.
 *
 * Usage:
 *   const client = new TopDeckRestClient(env.TOPDECK_API_KEY!);
 *   const info   = await client.getTournamentInfo("tid_abc123");
 */

import type {
  TopDeckTournamentInfo,
  TopDeckMyTournament,
  TopDeckStanding,
  TopDeckAttendee,
  TopDeckPlayerDetail,
} from "./types";

// ─── Error type ───────────────────────────────────────────────────────────────

export class TopDeckApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly endpoint: string,
    public readonly body?: string
  ) {
    super(`TopDeck API ${status} ${statusText} at ${endpoint}`);
    this.name = "TopDeckApiError";
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const TOPDECK_API_BASE = "https://topdeck.gg/api/v2";

export class TopDeckRestClient {
  private readonly headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      Authorization: apiKey,
      Accept: "application/json",
    };
  }

  // ── GET /v2/tournaments/{tid}/info ────────────────────────────────────────

  async getTournamentInfo(
    tid: string,
    signal?: AbortSignal
  ): Promise<TopDeckTournamentInfo> {
    return this.get<TopDeckTournamentInfo>(
      `/tournaments/${tid}/info`,
      signal
    );
  }

  // ── GET /v2/tournaments/{tid}/rounds/{round}/standings ────────────────────

  /**
   * Fetches standings for a specific round.
   * If `round` is omitted (or "latest"), TopDeck returns the current standings.
   */
  async getStandings(
    tid: string,
    round: number | "latest" = "latest",
    signal?: AbortSignal
  ): Promise<TopDeckStanding[]> {
    return this.get<TopDeckStanding[]>(
      `/tournaments/${tid}/rounds/${round}/standings`,
      signal
    );
  }

  // ── GET /v2/tournaments/{tid}/attendees ───────────────────────────────────
  // Requires organiser / judge role.

  async getAttendees(
    tid: string,
    signal?: AbortSignal
  ): Promise<TopDeckAttendee[]> {
    return this.get<TopDeckAttendee[]>(
      `/tournaments/${tid}/attendees`,
      signal
    );
  }

  // ── GET /v2/me/tournaments ────────────────────────────────────────────────

  async getMyTournaments(signal?: AbortSignal): Promise<TopDeckMyTournament[]> {
    return this.get<TopDeckMyTournament[]>("/me/tournaments", signal);
  }

  // ── GET /v2/tournaments/{tid}/players/{uid} ───────────────────────────────

  async getPlayerDetail(
    tid: string,
    uid: string,
    signal?: AbortSignal
  ): Promise<TopDeckPlayerDetail> {
    return this.get<TopDeckPlayerDetail>(
      `/tournaments/${tid}/players/${uid}`,
      signal
    );
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = `${TOPDECK_API_BASE}${path}`;
    let response: Response;

    try {
      response = await fetch(url, { headers: this.headers, signal });
    } catch (err) {
      // Network error or abort
      throw err;
    }

    if (!response.ok) {
      let body: string | undefined;
      try { body = await response.text(); } catch { /* ignore */ }
      throw new TopDeckApiError(response.status, response.statusText, url, body);
    }

    return response.json() as Promise<T>;
  }
}

// ─── Module-level singleton (initialised lazily) ──────────────────────────────

let _client: TopDeckRestClient | null = null;

/**
 * Returns a cached `TopDeckRestClient` for the given API key.
 * Pass `null` when the API key is not configured — returns `null`.
 */
export function getRestClient(apiKey: string | null): TopDeckRestClient | null {
  if (!apiKey) return null;
  if (!_client) _client = new TopDeckRestClient(apiKey);
  return _client;
}

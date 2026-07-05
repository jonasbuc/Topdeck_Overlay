/**
 * Tournament state enrichment.
 *
 * Fetches metadata from the TopDeck REST API and patches the stored
 * `TournamentState` with fields that are NOT available in webhook payloads:
 *   - startDate, status, location, headerImage  (from /info)
 *   - waitlistPlayers                            (from /attendees — optional)
 *
 * This is called automatically in the background after the first event for a
 * new tournament arrives at the webhook endpoint. Subsequent calls are
 * no-ops if the state already has a startDate (i.e. already enriched).
 *
 * Gracefully skips everything if TOPDECK_API_KEY is not configured.
 */

import { getTournamentState, patchTournamentState } from "./tournament-state";
import { getRestClient, TopDeckApiError } from "./rest-client";
import { env } from "@/lib/env";

/** How long to cache enrichment (ms). Re-enriches if status is still Ongoing. */
const ENRICH_CACHE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Enrich a tournament's stored state with REST API data.
 *
 * Safe to call concurrently — later writes are harmless overwrites.
 * Returns true if enrichment ran, false if skipped.
 *
 * Pass `force = true` to bypass the cache check (used by the admin resync
 * endpoint).
 */
export async function enrichTournamentState(
  tid: string,
  force = false
): Promise<boolean> {
  const client = getRestClient(env.TOPDECK_API_KEY ?? null);
  if (!client) {
    // API key not configured — REST features unavailable
    return false;
  }

  if (!force) {
    // Check if already enriched recently
    const existing = await getTournamentState(tid);
    if (existing?.startDate != null) {
      const ageMs = Date.now() - (existing.startDate ?? 0);
      // Re-enrich if tournament is ongoing and data is old; skip if Complete
      if (existing.status === "Complete" || ageMs < ENRICH_CACHE_MS) {
        return false;
      }
    }
  }

  // ── Fetch tournament info ───────────────────────────────────────────────
  let info;
  try {
    info = await client.getTournamentInfo(tid);
  } catch (err) {
    if (err instanceof TopDeckApiError) {
      // 404 = tournament not found (shouldn't happen if tid came from a webhook)
      // 401 = bad API key
      console.warn(
        `[enrichment] Could not fetch info for ${tid}: ${err.message}`
      );
    } else {
      console.warn(`[enrichment] Network error fetching info for ${tid}:`, err);
    }
    return false;
  }

  // ── Patch state with REST-only fields ──────────────────────────────────
  await patchTournamentState(tid, {
    name: info.name,
    game: info.game,
    format: info.format,
    startDate: info.startDate,
    status: info.status,
    location: info.location ?? null,
    headerImage: info.headerImage ?? null,
  });

  console.info(
    `[enrichment] ${tid} enriched — status=${info.status} startDate=${info.startDate}`
  );

  // ── Optionally fetch attendees (requires judge+ role) ──────────────────
  // We attempt this opportunistically; failure is non-fatal.
  try {
    const attendees = await client.getAttendees(tid);
    const waitlist = attendees.filter((a) => a.status === "waitlist");

    if (waitlist.length > 0) {
      await patchTournamentState(tid, { waitlistPlayers: waitlist });
      console.info(
        `[enrichment] ${tid} waitlist updated — ${waitlist.length} player(s)`
      );
    }
  } catch (err) {
    // 403 = not a judge — expected for non-staff API keys, not an error
    if (err instanceof TopDeckApiError && err.status === 403) {
      // silently skip
    } else {
      console.warn(`[enrichment] Could not fetch attendees for ${tid}:`, err);
    }
  }

  return true;
}

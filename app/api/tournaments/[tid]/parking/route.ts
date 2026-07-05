/**
 * GET /api/tournaments/:tid/parking
 *
 * Returns parking options near the tournament venue.
 *
 * Flow:
 *   1. Load tournament state from DB to get the venue location.
 *   2. Resolve lat/lng: use explicit coordinates if present, otherwise geocode
 *      the address via Nominatim.
 *   3. Check the ParkingCache for a fresh (non-expired) result.
 *   4. If cache miss: call the configured ParkingProvider, cache the result.
 *   5. Return normalized ParkingResponse.
 *
 * Error responses:
 *   404 { error: "no_venue" }       — tournament has no location data, or
 *                                     location has no usable address/coordinates
 *   404 { error: "geocode_failed" } — address could not be geocoded
 *   503 { error: "provider_error" } — provider API call failed
 *
 * Success response (200):
 *   ParkingResponse (see lib/parking/types.ts)
 *   results: [] is valid — means no parking was found within the search radius
 */

import { NextRequest, NextResponse } from "next/server";
import { getTournamentState } from "@/lib/topdeck/tournament-state";
import { geocodeAddress } from "@/lib/parking/geocoder";
import { getCached, setCache } from "@/lib/parking/cache";
import { createParkingProvider } from "@/lib/parking/factory";
import type { TopDeckLocation } from "@/lib/topdeck/types";
import type { GeoPoint, ParkingResponse } from "@/lib/parking/types";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a geocodable address string from a TopDeckLocation.
 * Returns an empty string if no useful address fields are present.
 */
function buildAddressString(location: TopDeckLocation): string {
  return [
    location.address,
    location.city,
    location.state,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function json<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { tid: string } }
) {
  const { tid } = params;

  // ── 1. Load tournament state ────────────────────────────────────────────
  const state = await getTournamentState(tid);
  const location = state?.location ?? null;

  if (!location) {
    return json({ error: "no_venue" }, 404);
  }

  // ── 2. Resolve coordinates ──────────────────────────────────────────────
  let point: GeoPoint | null = null;

  if (location.lat != null && location.lng != null) {
    // Exact coordinates available — use directly, no geocoding needed
    point = { lat: location.lat, lng: location.lng };
  } else {
    const address = buildAddressString(location);
    if (!address) {
      return json({ error: "no_venue" }, 404);
    }
    point = await geocodeAddress(address);
    if (!point) {
      return json({ error: "geocode_failed" }, 404);
    }
  }

  // ── 3. Check cache ──────────────────────────────────────────────────────
  const cached = await getCached(point.lat, point.lng);
  if (cached) {
    const provider = createParkingProvider();
    const body: ParkingResponse = {
      location: {
        lat: point.lat,
        lng: point.lng,
        name: location.name,
        address: buildAddressString(location) || undefined,
      },
      results: cached.results,
      cached: true,
      provider: cached.provider,
      attribution: provider.attribution,
    };
    return json(body);
  }

  // ── 4. Fetch from provider ──────────────────────────────────────────────
  const provider = createParkingProvider();
  let results;
  try {
    results = await provider.fetchNearby(point);
  } catch (err) {
    console.error(
      "[parking] provider error:",
      err instanceof Error ? err.message : err
    );
    return json({ error: "provider_error" }, 503);
  }

  // ── 5. Cache results ────────────────────────────────────────────────────
  // Fire-and-forget — a cache write failure must never fail the response
  setCache(point.lat, point.lng, provider.name, results).catch((err) => {
    console.error("[parking] cache write failed:", err instanceof Error ? err.message : err);
  });

  const body: ParkingResponse = {
    location: {
      lat: point.lat,
      lng: point.lng,
      name: location.name,
      address: buildAddressString(location) || undefined,
    },
    results,
    cached: false,
    provider: provider.name,
    attribution: provider.attribution,
  };

  return json(body);
}

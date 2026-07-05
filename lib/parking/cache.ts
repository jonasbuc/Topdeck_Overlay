/**
 * Parking — DB-backed result cache.
 *
 * Results from parking providers are expensive to fetch (external API calls,
 * Overpass rate limits) so we cache them in the ParkingCache table with a TTL.
 *
 * Cache key: "lat.toFixed(4):lng.toFixed(4)"
 *   4 decimal places ≈ 11 m precision — sufficient for a parking search that
 *   already uses a 1 km radius.  Two venues in the same city block share a
 *   cache entry, which is acceptable.
 *
 * TTL: 1 hour.  Expired rows are overwritten on the next cache miss.
 */

import { prisma } from "@/lib/prisma";
import type { ParkingResult } from "./types";

/** Cache lifetime in milliseconds. */
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Build a stable, human-readable cache key from a coordinate pair.
 * 4 decimal places ≈ 11 m precision.
 */
export function buildCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedParkingEntry {
  results: ParkingResult[];
  provider: "overpass" | "google_places";
  fetchedAt: Date;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Look up cached parking results for a location.
 *
 * Returns null on:
 * - No row in DB
 * - Row exists but has expired (expiresAt < now)
 *
 * Does NOT delete expired rows — they are overwritten on the next write.
 */
export async function getCached(
  lat: number,
  lng: number
): Promise<CachedParkingEntry | null> {
  const key = buildCacheKey(lat, lng);

  const row = await prisma.parkingCache.findUnique({ where: { cacheKey: key } });
  if (!row) return null;

  // Expired?
  if (row.expiresAt < new Date()) return null;

  let results: ParkingResult[];
  try {
    results = JSON.parse(row.results) as ParkingResult[];
  } catch {
    // Corrupt cache entry — treat as miss
    return null;
  }

  return {
    results,
    provider: row.provider as "overpass" | "google_places",
    fetchedAt: row.fetchedAt,
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert parking results into the cache.
 * Overwrites any existing row (including expired ones) for this location.
 */
export async function setCache(
  lat: number,
  lng: number,
  provider: "overpass" | "google_places",
  results: ParkingResult[]
): Promise<void> {
  const key = buildCacheKey(lat, lng);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  await prisma.parkingCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      lat,
      lng,
      provider,
      results: JSON.stringify(results),
      fetchedAt: now,
      expiresAt,
    },
    update: {
      provider,
      results: JSON.stringify(results),
      fetchedAt: now,
      expiresAt,
    },
  });
}

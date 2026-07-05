/**
 * Parking provider — OpenStreetMap via the Overpass API.
 *
 * Queries parking amenities within a radius using Overpass QL.
 * Free to use; no API key required.
 *
 * Overpass terms of use:
 *   - Include a descriptive User-Agent header.
 *   - Respect the public instance rate limits (~1–2 req/s).
 *   - The parking cache in cache.ts ensures we never hammer the API.
 *
 * Attribution: © OpenStreetMap contributors (must be shown in UI)
 *   https://www.openstreetmap.org/copyright
 */

import type { ParkingResult, ParkingProvider, GeoPoint } from "../types";
import { haversineMeters, walkingMinutes, navigationUrl } from "../distance";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "topdeck-live/1.0 (tournament coverage; https://github.com/jonasbuc/Topdeck_Overlay)";
const DEFAULT_RADIUS_M = 1000;
const TIMEOUT_MS = 20_000;

// ─── Overpass response types ──────────────────────────────────────────────────

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  /** Present on nodes */
  lat?: number;
  /** Present on nodes (note: lon, not lng) */
  lon?: number;
  /** Present on ways (centroid of the way's bounding box) */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class OverpassParkingProvider implements ParkingProvider {
  readonly name = "overpass" as const;
  readonly attribution = "© OpenStreetMap contributors";

  async fetchNearby(
    point: GeoPoint,
    radiusMeters: number = DEFAULT_RADIUS_M
  ): Promise<ParkingResult[]> {
    const { lat, lng } = point;

    // Overpass QL: fetch both nodes (point parking) and ways (lot outlines)
    // `out center` on ways returns the centroid so we always get coordinates.
    const query = [
      `[out:json][timeout:${Math.ceil(TIMEOUT_MS / 1000)}];`,
      `(`,
      `  node["amenity"="parking"](around:${radiusMeters},${lat},${lng});`,
      `  way["amenity"="parking"](around:${radiusMeters},${lat},${lng});`,
      `);`,
      `out center;`,
    ].join("\n");

    let res: Response;
    try {
      res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(
        `Overpass fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      throw new Error(`Overpass API returned ${res.status} ${res.statusText}`);
    }

    let json: OverpassResponse;
    try {
      json = (await res.json()) as OverpassResponse;
    } catch {
      throw new Error("Overpass API returned invalid JSON");
    }

    const results: ParkingResult[] = [];

    for (const el of json.elements) {
      const normalized = this.normalize(el, point);
      if (normalized) results.push(normalized);
    }

    // Sort by distance ascending
    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  private normalize(el: OverpassElement, venue: GeoPoint): ParkingResult | null {
    // Extract coordinates: nodes have lat/lon directly, ways have center
    const lat = el.type === "way" ? el.center?.lat : el.lat;
    const lon = el.type === "way" ? el.center?.lon : el.lon;

    if (lat == null || lon == null) return null;

    const tags = el.tags ?? {};
    const distM = haversineMeters(venue, { lat, lng: lon });

    // ── Address ──────────────────────────────────────────────────────────────
    const streetPart =
      tags["addr:street"] && tags["addr:housenumber"]
        ? `${tags["addr:street"]} ${tags["addr:housenumber"]}`
        : tags["addr:street"] ?? null;
    const addressParts = [streetPart, tags["addr:city"]].filter(Boolean);
    const address =
      addressParts.length > 0
        ? addressParts.join(", ")
        : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    // ── Price ────────────────────────────────────────────────────────────────
    let priceInfo: string | null = null;
    if (tags.fee === "no") priceInfo = "Free";
    else if (tags.fee === "yes") priceInfo = "Paid";

    // ── Accessibility ────────────────────────────────────────────────────────
    let accessible: boolean | null = null;
    if (tags.wheelchair === "yes" || tags.wheelchair === "designated") {
      accessible = true;
    } else if (tags.wheelchair === "no") {
      accessible = false;
    }

    // ── Opening hours ────────────────────────────────────────────────────────
    const openingHours = tags.opening_hours ?? null;

    // ── Name ─────────────────────────────────────────────────────────────────
    const name = tags.name ?? tags["name:en"] ?? "";

    return {
      id: `overpass-${el.type}-${el.id}`,
      name,
      address,
      lat,
      lng: lon,
      distanceMeters: Math.round(distM),
      walkingMinutes: walkingMinutes(distM),
      drivingMinutes: null,
      priceInfo,
      openingHours,
      rating: null,
      ratingCount: null,
      accessible,
      navigationUrl: navigationUrl(lat, lon),
      source: "overpass",
    };
  }
}

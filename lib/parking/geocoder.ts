/**
 * Parking — geocoding via Nominatim (OpenStreetMap).
 *
 * Converts a free-text address string into a GeoPoint (lat/lng).
 *
 * Nominatim terms of use:
 *   - Include a descriptive User-Agent header identifying the application.
 *   - Maximum 1 request per second — always cache results (the parking cache
 *     in cache.ts handles this, so the geocoder itself doesn't need to cache).
 *   - Avoid bulk/automated queries outside of user-triggered actions.
 *
 * This function returns null (not throws) on any failure so the caller can
 * produce a clean 404 / fallback rather than a 500.
 */

import type { GeoPoint } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "topdeck-live/1.0 (tournament coverage; https://github.com/jonasbuc/Topdeck_Overlay)";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode an address string to WGS-84 coordinates.
 *
 * @param address - Free-text address, e.g. "ExCeL London, Royal Victoria Dock, E16 1XL, UK"
 * @param signal  - Optional AbortSignal for request cancellation
 * @returns Resolved GeoPoint, or null if the address could not be geocoded.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<GeoPoint | null> {
  if (!address.trim()) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", address.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  // Include address details in the response (helps with disambiguation)
  url.searchParams.set("addressdetails", "0");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal,
    });
  } catch (err) {
    console.warn("[geocoder] fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }

  if (!res.ok) {
    console.warn(`[geocoder] Nominatim returned ${res.status} for query: ${address}`);
    return null;
  }

  let data: NominatimResult[];
  try {
    data = await res.json() as NominatimResult[];
  } catch {
    console.warn("[geocoder] failed to parse Nominatim response");
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);

  if (isNaN(lat) || isNaN(lng)) {
    console.warn("[geocoder] Nominatim returned invalid coordinates for:", address);
    return null;
  }

  return { lat, lng };
}

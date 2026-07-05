/**
 * Parking provider factory.
 *
 * Returns the appropriate ParkingProvider implementation based on the
 * PARKING_PROVIDER environment variable.
 *
 * Default: "overpass" (free, no API key required)
 * Optional: "google_places" (requires GOOGLE_MAPS_API_KEY)
 *
 * If "google_places" is configured but GOOGLE_MAPS_API_KEY is missing,
 * this factory logs a warning and falls back to Overpass silently so the
 * feature remains available rather than throwing at startup.
 */

import { env } from "@/lib/env";
import type { ParkingProvider } from "./types";
import { OverpassParkingProvider } from "./providers/overpass";
import { GooglePlacesParkingProvider } from "./providers/google-places";

/**
 * Create and return the parking provider configured in the environment.
 *
 * A new instance is created on every call — providers are stateless so
 * this is intentional (no need for a singleton).
 */
export function createParkingProvider(): ParkingProvider {
  if (env.PARKING_PROVIDER === "google_places") {
    if (!env.GOOGLE_MAPS_API_KEY) {
      console.warn(
        "[parking] PARKING_PROVIDER=google_places but GOOGLE_MAPS_API_KEY is not set. " +
          "Falling back to Overpass/OSM provider."
      );
      return new OverpassParkingProvider();
    }
    return new GooglePlacesParkingProvider(env.GOOGLE_MAPS_API_KEY);
  }

  // Default: Overpass
  return new OverpassParkingProvider();
}

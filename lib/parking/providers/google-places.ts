/**
 * Parking provider — Google Places API (New, v1).
 *
 * Uses the Places Nearby Search endpoint to find parking near a coordinate.
 * Requires a valid GOOGLE_MAPS_API_KEY with the "Places API (New)" enabled.
 *
 * API reference:
 *   https://developers.google.com/maps/documentation/places/web-service/nearby-search
 *
 * Billing note:
 *   Each Nearby Search call is billed as a "basic" Places request (~$0.032/call).
 *   The parking cache in cache.ts limits calls to at most 1 per venue per hour.
 *
 * Attribution:
 *   "Powered by Google" must be displayed in the UI per Google's ToS.
 */

import type { ParkingResult, ParkingProvider, GeoPoint } from "../types";
import { haversineMeters, walkingMinutes, navigationUrl } from "../distance";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DEFAULT_RADIUS_M = 1000;
const MAX_RESULTS = 20;
const TIMEOUT_MS = 15_000;

// Field mask — only request the fields we actually use to minimise billing
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.currentOpeningHours",
  "places.accessibilityOptions",
].join(",");

// ─── Google Places response types ────────────────────────────────────────────

type PriceLevel =
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE"
  | "PRICE_LEVEL_UNSPECIFIED";

interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  accessibilityOptions?: {
    wheelchairAccessibleParking?: boolean;
  };
}

interface PlacesSearchResponse {
  places?: PlaceResult[];
}

// ─── Price level mapping ──────────────────────────────────────────────────────

const PRICE_LEVEL_LABEL: Partial<Record<PriceLevel, string>> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

// ─── Provider ────────────────────────────────────────────────────────────────

export class GooglePlacesParkingProvider implements ParkingProvider {
  readonly name = "google_places" as const;
  readonly attribution = "Powered by Google";

  constructor(private readonly apiKey: string) {}

  async fetchNearby(
    point: GeoPoint,
    radiusMeters: number = DEFAULT_RADIUS_M
  ): Promise<ParkingResult[]> {
    const body = {
      includedTypes: ["parking"],
      maxResultCount: MAX_RESULTS,
      languageCode: "en",
      locationRestriction: {
        circle: {
          center: { latitude: point.lat, longitude: point.lng },
          radius: radiusMeters,
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(PLACES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(
        `Google Places fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(
        `Google Places API returned ${res.status} ${res.statusText}: ${errorBody}`
      );
    }

    let json: PlacesSearchResponse;
    try {
      json = (await res.json()) as PlacesSearchResponse;
    } catch {
      throw new Error("Google Places API returned invalid JSON");
    }

    const places = json.places ?? [];

    const results: ParkingResult[] = [];
    for (const place of places) {
      const normalized = this.normalize(place, point);
      if (normalized) results.push(normalized);
    }

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  private normalize(place: PlaceResult, venue: GeoPoint): ParkingResult | null {
    if (!place.location) return null;

    const lat = place.location.latitude;
    const lng = place.location.longitude;
    const distM = haversineMeters(venue, { lat, lng });

    // ── Opening hours ────────────────────────────────────────────────────────
    let openingHours: string | null = null;
    if (place.currentOpeningHours?.openNow != null) {
      openingHours = place.currentOpeningHours.openNow ? "Open now" : "Closed";
    }

    // ── Accessibility ────────────────────────────────────────────────────────
    let accessible: boolean | null = null;
    if (place.accessibilityOptions?.wheelchairAccessibleParking != null) {
      accessible = place.accessibilityOptions.wheelchairAccessibleParking;
    }

    // ── Price ────────────────────────────────────────────────────────────────
    const priceInfo =
      place.priceLevel && place.priceLevel !== "PRICE_LEVEL_UNSPECIFIED"
        ? (PRICE_LEVEL_LABEL[place.priceLevel] ?? null)
        : null;

    // ── ID — strip the "places/" prefix Google returns ───────────────────────
    const rawId = place.id ?? "";
    const id = `google-${rawId.replace(/^places\//, "")}`;

    return {
      id,
      name: place.displayName?.text ?? "",
      address: place.formattedAddress ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng,
      distanceMeters: Math.round(distM),
      walkingMinutes: walkingMinutes(distM),
      drivingMinutes: null,
      priceInfo,
      openingHours,
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      accessible,
      navigationUrl: navigationUrl(lat, lng),
      source: "google_places",
    };
  }
}

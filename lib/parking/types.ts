/**
 * Parking feature — core types.
 *
 * These types are shared across the parking provider abstraction, cache, and
 * API route. They are deliberately kept separate from TopDeck types so the
 * parking module can be used independently.
 */

// ─── Geo primitives ───────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

// ─── Normalized parking result ────────────────────────────────────────────────

/**
 * A single parking option, normalized from any provider to a common shape.
 * All provider-specific fields are mapped to this type before being returned.
 */
export interface ParkingResult {
  /** Stable ID within the provider, e.g. "overpass-node-12345" */
  id: string;
  /** Venue/lot name — empty string if the provider has no name for this lot */
  name: string;
  /** Formatted address or "lat, lng" fallback */
  address: string;
  lat: number;
  lng: number;
  /** Straight-line Haversine distance from the tournament venue in metres */
  distanceMeters: number;
  /** Estimated walking time in minutes (ceil(distanceMeters / 80)) */
  walkingMinutes: number;
  /** Driving time in minutes — null unless the provider returns routing data */
  drivingMinutes: number | null;
  /**
   * Human-readable price hint.
   * Examples: "Free", "Paid", "€", "€€", "€€€"
   * null if no pricing info is available from the provider.
   */
  priceInfo: string | null;
  /** Opening hours string — null if unknown */
  openingHours: string | null;
  /** Star rating 0–5 — null if not provided (Overpass never provides ratings) */
  rating: number | null;
  /** Number of ratings — null if not provided */
  ratingCount: number | null;
  /**
   * Wheelchair-accessible parking available.
   * true = yes, false = no, null = unknown.
   */
  accessible: boolean | null;
  /** Google Maps navigation deep-link to this parking location */
  navigationUrl: string;
  /** Which provider produced this result */
  source: "overpass" | "google_places";
}

// ─── Provider abstraction ─────────────────────────────────────────────────────

/**
 * All parking providers implement this interface.
 * The factory in `factory.ts` returns the correct implementation based on
 * the PARKING_PROVIDER environment variable.
 */
export interface ParkingProvider {
  /** Fetch parking options near the given point within radiusMeters. */
  fetchNearby(point: GeoPoint, radiusMeters?: number): Promise<ParkingResult[]>;
  /** Attribution text required by the provider's terms of service. */
  readonly attribution: string;
  /** Stable provider identifier — matches ParkingResult.source */
  readonly name: "overpass" | "google_places";
}

// ─── API response shape ───────────────────────────────────────────────────────

/**
 * Shape returned by GET /api/tournaments/:tid/parking.
 */
export interface ParkingResponse {
  /** Resolved coordinates of the tournament venue */
  location: GeoPoint & { name?: string; address?: string };
  /** Parking results sorted by distance ascending */
  results: ParkingResult[];
  /** Whether results came from the DB cache (true) or a live fetch (false) */
  cached: boolean;
  provider: "overpass" | "google_places";
  /** Attribution string — must be displayed in the UI per provider ToS */
  attribution: string;
}

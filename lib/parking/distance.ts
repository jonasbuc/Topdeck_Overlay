/**
 * Parking — geodesic distance and time estimation utilities.
 *
 * All functions are pure (no I/O) and can be used safely in any context.
 */

import type { GeoPoint } from "./types";

// Earth's mean radius in metres (WGS-84 approximation)
const EARTH_RADIUS_M = 6_371_000;

// Average walking speed in metres per minute (~5 km/h)
const WALK_SPEED_M_PER_MIN = 80;

/**
 * Compute the great-circle distance between two coordinates using the
 * Haversine formula. Returns the distance in metres.
 *
 * Accuracy: within ~0.5% for distances under 1000 km — more than sufficient
 * for the ~1 km parking search radius.
 */
export function haversineMeters(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const a =
    sinDLat * sinDLat +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Estimate the walking time in whole minutes for a given distance.
 * Always rounds up so we never underestimate the walk.
 *
 * @param distanceMeters - straight-line Haversine distance (actual walking
 *   route is typically 20–40% longer, but we use the straight-line distance
 *   to remain consistent with what providers return)
 */
export function walkingMinutes(distanceMeters: number): number {
  return Math.ceil(distanceMeters / WALK_SPEED_M_PER_MIN);
}

/**
 * Build a Google Maps navigation deep-link for the given destination.
 * Opens turn-by-turn directions from the user's current location.
 */
export function navigationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

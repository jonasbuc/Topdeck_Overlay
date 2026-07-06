"use client";

/**
 * ParkingSection
 *
 * Fetches and displays parking options near the tournament venue.
 * Rendered on the dashboard when `state.location` is non-null.
 *
 * States:
 *  - Loading  — skeleton spinner while fetching
 *  - No venue — hidden entirely (caller guards this)
 *  - Empty    — "No parking found within 1 km" message
 *  - Error    — user-friendly error with retry button
 *  - Results  — map + sortable list of parking options
 *
 * Filters (client-side, no re-fetch):
 *  - "Closest"    — sort by distance (default)
 *  - "Open now"   — only show results where openingHours contains "Open now"
 *  - "Free"       — only show results where priceInfo === "Free"
 *  - "Accessible" — only show results where accessible === true
 *
 * Map:
 *  - OpenStreetMap tiles show venue + parking markers
 *  - "Use my location" adds the user's device position when permission is granted
 */

import { useEffect, useState, useCallback, useId, useMemo } from "react";
import { haversineMeters } from "@/lib/parking/distance";
import type { GeoPoint, ParkingResponse, ParkingResult } from "@/lib/parking/types";
import type { TopDeckLocation } from "@/lib/topdeck/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "closest" | "open" | "free" | "accessible";

interface Props {
  tid: string;
  location: TopDeckLocation | null;
}

interface UserPoint extends GeoPoint {
  accuracyMeters: number | null;
}

interface TileSpec {
  key: string;
  url: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

interface MarkerSpec {
  id: string;
  type: "venue" | "parking" | "user";
  label: string;
  leftPct: number;
  topPct: number;
  result?: ParkingResult;
}

interface ParkingMapModel {
  zoom: number;
  tiles: TileSpec[];
  markers: MarkerSpec[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatWalk(min: number): string {
  if (min < 1) return "< 1 min walk";
  return `~${min} min walk`;
}

function applyFilter(results: ParkingResult[], filter: Filter): ParkingResult[] {
  switch (filter) {
    case "closest":
      return [...results].sort((a, b) => a.distanceMeters - b.distanceMeters);
    case "open":
      return results.filter(
        (r) => r.openingHours?.toLowerCase().includes("open") === true
      );
    case "free":
      return results.filter((r) => r.priceInfo === "Free");
    case "accessible":
      return results.filter((r) => r.accessible === true);
    default:
      return results;
  }
}

const MAP_WIDTH = 960;
const MAP_HEIGHT = 360;
const TILE_SIZE = 256;
const MIN_ZOOM = 13;
const MAX_ZOOM = 17;
const USER_FIT_RADIUS_M = 5000;
const MAX_MAP_RESULTS = 30;

function project(point: GeoPoint, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const latRad = (point.lat * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      scale,
  };
}

function chooseZoom(points: GeoPoint[]): number {
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const projected = points.map((point) => project(point, zoom));
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width <= MAP_WIDTH - 180 && height <= MAP_HEIGHT - 110) {
      return zoom;
    }
  }
  return MIN_ZOOM;
}

function buildMapModel(
  venue: GeoPoint,
  results: ParkingResult[],
  userPoint: UserPoint | null
): ParkingMapModel {
  const parkingPoints = results.map((result) => ({
    lat: result.lat,
    lng: result.lng,
  }));
  const shouldFitUser =
    userPoint != null && haversineMeters(venue, userPoint) <= USER_FIT_RADIUS_M;
  const points = [
    venue,
    ...parkingPoints,
    ...(shouldFitUser && userPoint ? [userPoint] : []),
  ];
  const zoom = chooseZoom(points);
  const projected = points.map((point) => project(point, zoom));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const originX = centerX - MAP_WIDTH / 2;
  const originY = centerY - MAP_HEIGHT / 2;
  const tileCount = 2 ** zoom;

  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + MAP_WIDTH) / TILE_SIZE);
  const minTileY = Math.max(0, Math.floor(originY / TILE_SIZE));
  const maxTileY = Math.min(
    tileCount - 1,
    Math.floor((originY + MAP_HEIGHT) / TILE_SIZE)
  );

  const tiles: TileSpec[] = [];
  for (let x = minTileX; x <= maxTileX; x++) {
    for (let y = minTileY; y <= maxTileY; y++) {
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        leftPct: ((x * TILE_SIZE - originX) / MAP_WIDTH) * 100,
        topPct: ((y * TILE_SIZE - originY) / MAP_HEIGHT) * 100,
        widthPct: (TILE_SIZE / MAP_WIDTH) * 100,
        heightPct: (TILE_SIZE / MAP_HEIGHT) * 100,
      });
    }
  }

  const markerPosition = (point: GeoPoint) => {
    const p = project(point, zoom);
    return {
      leftPct: ((p.x - originX) / MAP_WIDTH) * 100,
      topPct: ((p.y - originY) / MAP_HEIGHT) * 100,
    };
  };

  const markers: MarkerSpec[] = [
    {
      id: "venue",
      type: "venue",
      label: "Venue",
      ...markerPosition(venue),
    },
    ...results.map((result, index) => ({
      id: result.id,
      type: "parking" as const,
      label: String(index + 1),
      result,
      ...markerPosition({ lat: result.lat, lng: result.lng }),
    })),
  ];

  if (userPoint) {
    markers.push({
      id: "user",
      type: "user",
      label: "You",
      ...markerPosition(userPoint),
    });
  }

  return { zoom, tiles, markers };
}

function nearestParking(
  userPoint: UserPoint | null,
  results: ParkingResult[]
): { result: ParkingResult; distanceMeters: number } | null {
  if (!userPoint || results.length === 0) return null;
  return results.reduce<{ result: ParkingResult; distanceMeters: number } | null>(
    (nearest, result) => {
      const distanceMeters = haversineMeters(userPoint, {
        lat: result.lat,
        lng: result.lng,
      });
      if (!nearest || distanceMeters < nearest.distanceMeters) {
        return { result, distanceMeters };
      }
      return nearest;
    },
    null
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParkingCard({
  result,
  selected,
}: {
  result: ParkingResult;
  selected: boolean;
}) {
  return (
    <a
      href={result.navigationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`parking-card${selected ? " selected" : ""}`}
      aria-label={`Open navigation to ${result.name || "parking"}`}
    >
      {/* Header row: name + distance */}
      <div className="parking-card-header">
        <span className="parking-card-name">
          {result.name || "Parking"}
        </span>
        <span className="parking-card-distance">
          {formatDistance(result.distanceMeters)}
        </span>
      </div>

      {/* Address */}
      {result.address && (
        <div className="parking-card-address">{result.address}</div>
      )}

      {/* Pills row */}
      <div className="parking-card-pills">
        <span className="parking-pill parking-pill-walk">
          🚶 {formatWalk(result.walkingMinutes)}
        </span>

        {result.priceInfo && (
          <span
            className={`parking-pill ${
              result.priceInfo === "Free"
                ? "parking-pill-free"
                : "parking-pill-paid"
            }`}
          >
            {result.priceInfo === "Free" ? "🆓 Free" : `💳 ${result.priceInfo}`}
          </span>
        )}

        {result.openingHours && (
          <span className="parking-pill parking-pill-hours">
            🕐 {result.openingHours.length > 20
              ? result.openingHours.slice(0, 20) + "…"
              : result.openingHours}
          </span>
        )}

        {result.accessible === true && (
          <span className="parking-pill parking-pill-accessible">
            ♿ Accessible
          </span>
        )}

        {result.rating != null && (
          <span className="parking-pill parking-pill-rating">
            ⭐ {result.rating.toFixed(1)}
            {result.ratingCount != null && (
              <span className="parking-rating-count">
                {" "}({result.ratingCount.toLocaleString()})
              </span>
            )}
          </span>
        )}
      </div>

      {/* Navigate CTA */}
      <div className="parking-card-nav">
        Navigate ↗
      </div>
    </a>
  );
}

function ParkingMap({
  response,
  results,
  totalResults,
  selectedParkingId,
  onSelectParking,
}: {
  response: ParkingResponse;
  results: ParkingResult[];
  totalResults: number;
  selectedParkingId: string | null;
  onSelectParking: (id: string) => void;
}) {
  const [userPoint, setUserPoint] = useState<UserPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const venue = useMemo(
    () => ({ lat: response.location.lat, lng: response.location.lng }),
    [response.location.lat, response.location.lng]
  );
  const model = useMemo(
    () => buildMapModel(venue, results, userPoint),
    [venue, results, userPoint]
  );
  const nearest = nearestParking(userPoint, results);
  const userToVenue = userPoint ? haversineMeters(userPoint, venue) : null;

  const handleLocate = () => {
    if (!("geolocation" in navigator)) {
      setGeoMessage("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
        });
        setLocating(false);
      },
      () => {
        setGeoMessage("Could not access your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const statusText = userPoint
    ? [
        userToVenue != null ? `${formatDistance(Math.round(userToVenue))} to venue` : null,
        nearest ? `${formatDistance(Math.round(nearest.distanceMeters))} to nearest parking` : null,
        userPoint.accuracyMeters != null ? `±${formatDistance(userPoint.accuracyMeters)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : totalResults > results.length
    ? `${results.length} closest of ${totalResults} options on map`
    : `${results.length} option${results.length === 1 ? "" : "s"} on map`;

  return (
    <div className="parking-map">
      <div className="parking-map-topbar">
        <div>
          <div className="parking-map-title">Map</div>
          <div className="parking-map-status">
            {geoMessage ?? statusText}
          </div>
        </div>
        <button
          type="button"
          className="parking-locate-btn"
          onClick={handleLocate}
          disabled={locating}
        >
          {locating ? "Locating..." : userPoint ? "Update location" : "Use my location"}
        </button>
      </div>

      <div className="parking-map-canvas" role="img" aria-label="Parking map">
        {model.tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            className="parking-map-tile"
            draggable={false}
            style={{
              left: `${tile.leftPct}%`,
              top: `${tile.topPct}%`,
              width: `${tile.widthPct}%`,
              height: `${tile.heightPct}%`,
            }}
          />
        ))}

        <div className="parking-map-shade" />

        {model.markers.map((marker) => {
          const markerStyle = {
            left: `${marker.leftPct}%`,
            top: `${marker.topPct}%`,
          };

          if (marker.type === "parking" && marker.result) {
            const selected = marker.result.id === selectedParkingId;
            return (
              <button
                key={marker.id}
                type="button"
                className={`parking-map-marker parking-map-marker-parking${selected ? " selected" : ""}`}
                style={markerStyle}
                onClick={() => onSelectParking(marker.result!.id)}
                aria-label={`${marker.result.name || "Parking"} ${formatDistance(marker.result.distanceMeters)} from venue`}
              >
                {marker.label}
              </button>
            );
          }

          return (
            <div
              key={marker.id}
              className={`parking-map-marker parking-map-marker-${marker.type}`}
              style={markerStyle}
              aria-label={marker.label}
            >
              {marker.label}
            </div>
          );
        })}
      </div>

      <div className="parking-map-legend">
        <span><span className="parking-legend-dot venue" />Venue</span>
        <span><span className="parking-legend-dot parking" />Parking</span>
        {userPoint && <span><span className="parking-legend-dot user" />You</span>}
      </div>
    </div>
  );
}

function FilterBar({
  active,
  onChange,
  results,
}: {
  active: Filter;
  onChange: (f: Filter) => void;
  results: ParkingResult[];
}) {
  const hasOpen = results.some((r) =>
    r.openingHours?.toLowerCase().includes("open")
  );
  const hasFree = results.some((r) => r.priceInfo === "Free");
  const hasAccessible = results.some((r) => r.accessible === true);

  const filters: { key: Filter; label: string; visible: boolean }[] = [
    { key: "closest", label: "Closest", visible: true },
    { key: "open", label: "Open now", visible: hasOpen },
    { key: "free", label: "Free", visible: hasFree },
    { key: "accessible", label: "Accessible", visible: hasAccessible },
  ];

  return (
    <div className="parking-filter-bar">
      {filters
        .filter((f) => f.visible)
        .map((f) => (
          <button
            key={f.key}
            type="button"
            className={`parking-filter-btn${active === f.key ? " active" : ""}`}
            onClick={() => onChange(f.key)}
          >
            {f.label}
          </button>
        ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParkingSection({ tid, location }: Props) {
  const [data, setData] = useState<ParkingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("closest");
  const [open, setOpen] = useState(false);
  const [selectedParkingId, setSelectedParkingId] = useState<string | null>(null);
  const bodyId = useId();

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/parking`);
      if (res.status === 404) {
        const body = await res.json() as { error: string };
        if (body.error === "no_venue") {
          setData(null);
          setLoading(false);
          return;
        }
        if (body.error === "geocode_failed") {
          setError("Could not locate the venue address. Try adding coordinates to the tournament location.");
          setLoading(false);
          return;
        }
      }
      if (!res.ok) {
        setError(`Failed to load parking info (${res.status})`);
        setLoading(false);
        return;
      }
      const json = await res.json() as ParkingResponse;
      setData(json);
      setSelectedParkingId((current) =>
        current && json.results.some((result) => result.id === current)
          ? current
          : json.results[0]?.id ?? null
      );
    } catch {
      setError("Network error — could not reach the parking API.");
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    if (open && !data && !loading) {
      fetch_();
    }
  }, [open, data, loading, fetch_]);

  // Only render if the tournament has location data
  if (!location) return null;

  const locationLabel = [location.city, location.country].filter(Boolean).join(", ");
  const filtered = data ? applyFilter(data.results, filter) : [];
  const mapResults = filtered.slice(0, MAX_MAP_RESULTS);

  return (
    <details
      className="card parking-section"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      {/* ── Collapsible header ──────────────────────────────────────────── */}
      <summary className="parking-header">
        <span className="section-title parking-section-title">
          🅿️ Parking near venue
          {locationLabel && (
            <span className="parking-header-location"> — {locationLabel}</span>
          )}
        </span>
        <span className="parking-header-chevron">{open ? "▲" : "▼"}</span>
      </summary>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div id={bodyId} className="parking-body">
          {/* Loading */}
          {loading && (
            <div className="parking-loading">
              <span className="parking-spinner" />
              <span>Finding parking near venue…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="parking-error">
              <span>⚠️ {error}</span>
              <button type="button" className="parking-retry-btn" onClick={fetch_}>
                Retry
              </button>
            </div>
          )}

          {/* Results */}
          {!loading && !error && data && (
            <>
              <ParkingMap
                response={data}
                results={mapResults}
                totalResults={filtered.length}
                selectedParkingId={selectedParkingId}
                onSelectParking={setSelectedParkingId}
              />

              {data.results.length > 0 && (
                <FilterBar
                  active={filter}
                  onChange={setFilter}
                  results={data.results}
                />
              )}

              {filtered.length === 0 && data.results.length === 0 && (
                <div className="empty-state parking-empty">
                  No parking found within 1 km of the venue.
                </div>
              )}

              {filtered.length === 0 && data.results.length > 0 && (
                <div className="empty-state parking-empty">
                  No results match this filter.
                </div>
              )}

              <div className="parking-grid">
                {filtered.map((result) => (
                  <ParkingCard
                    key={result.id}
                    result={result}
                    selected={result.id === selectedParkingId}
                  />
                ))}
              </div>

              {/* Attribution */}
              <div className="parking-attribution">
                {data.cached && (
                  <span className="parking-cached-badge">Cached</span>
                )}
                {data.attribution}
              </div>
            </>
          )}
      </div>
    </details>
  );
}

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
 *  - Results  — sortable list of parking options
 *
 * Filters (client-side, no re-fetch):
 *  - "Closest"    — sort by distance (default)
 *  - "Open now"   — only show results where openingHours contains "Open now"
 *  - "Free"       — only show results where priceInfo === "Free"
 *  - "Accessible" — only show results where accessible === true
 */

import { useEffect, useState, useCallback, useId } from "react";
import type { ParkingResponse, ParkingResult } from "@/lib/parking/types";
import type { TopDeckLocation } from "@/lib/topdeck/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "closest" | "open" | "free" | "accessible";

interface Props {
  tid: string;
  location: TopDeckLocation | null;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParkingCard({ result }: { result: ParkingResult }) {
  return (
    <a
      href={result.navigationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="parking-card"
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
                  <ParkingCard key={result.id} result={result} />
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

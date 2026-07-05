/**
 * TournamentInfoBanner
 *
 * Shows REST-enriched tournament metadata (startDate, status, location,
 * headerImage) at the top of the coverage dashboard. Only renders when
 * `state.startDate` is non-null — i.e. after enrichment has run.
 */

"use client";

import Image from "next/image";
import type { LiveTournamentState } from "@/lib/topdeck/types";

interface Props {
  state: LiveTournamentState;
}

const STATUS_LABEL: Record<string, string> = {
  "Not Started": "Not Started",
  Ongoing: "Live",
  Complete: "Complete",
};

const STATUS_CLASS: Record<string, string> = {
  "Not Started": "not-started",
  Ongoing: "ongoing",
  Complete: "complete",
};

function formatDate(unixMs: number): string {
  return new Date(unixMs).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TournamentInfoBanner({ state }: Props) {
  if (!state.startDate) return null;

  const { headerImage, status, location, startDate } = state;

  const locationStr = location
    ? [location.city, location.state, location.country]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="tournament-info-banner">
      {headerImage && (
        <Image
          src={headerImage}
          alt={state.name}
          width={60}
          height={60}
          className="info-banner-image"
          unoptimized
        />
      )}
      <div className="info-banner-body">
        <div className="info-banner-row">
          <span className={`status-badge ${STATUS_CLASS[status] ?? "not-started"}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
          {startDate && (
            <span className="info-banner-date">📅 {formatDate(startDate)}</span>
          )}
          {locationStr && (
            <span className="info-banner-location">📍 {locationStr}</span>
          )}
        </div>
      </div>
    </div>
  );
}

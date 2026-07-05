"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TopDeckMyTournament } from "@/lib/topdeck/types";
import type { TournamentSummary } from "@/lib/topdeck/tournament-state";

type Tournament = TopDeckMyTournament | TournamentSummary;

interface ApiResponse {
  tournaments: Tournament[];
  source: "api" | "db";
}

function formatDate(unixMs: number | null): string {
  if (!unixMs) return "Date TBD";
  return new Date(unixMs).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatus(t: Tournament): string {
  return (t as TournamentSummary).status ?? "Not Started";
}

function getTid(t: Tournament): string {
  return (t as TournamentSummary).tid ?? (t as TopDeckMyTournament).tid;
}

const STATUS_CLASS: Record<string, string> = {
  "Not Started": "not-started",
  Ongoing: "ongoing",
  Complete: "complete",
};

const STATUS_LABEL: Record<string, string> = {
  "Not Started": "Not Started",
  Ongoing: "Live",
  Complete: "Complete",
};

function OverlayLinksPopover({ tid }: { tid: string }) {
  const base = `/overlay/${tid}`;
  const overlays = [
    { name: "Full overlay", path: base },
    { name: "Clock only", path: `${base}/clock` },
    { name: "Standings", path: `${base}/standings` },
    { name: "Feature match", path: `${base}/feature` },
    { name: "Results ticker", path: `${base}/ticker` },
  ];

  return (
    <div className="overlay-links-panel">
      <div className="overlay-links-title">Overlays</div>
      {overlays.map((o) => (
        <Link
          key={o.path}
          href={o.path}
          target="_blank"
          className="overlay-link-row"
        >
          <span className="overlay-link-name">{o.name}</span>
          <span className="overlay-link-open">↗</span>
        </Link>
      ))}
    </div>
  );
}

export default function TournamentsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTid, setExpandedTid] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="tournaments-page">
      <div className="tournaments-header">
        <h1>My Tournaments</h1>
        {data && (
          <span className="tournaments-source-badge">
            {data.source === "api" ? "TopDeck API" : "Local DB"}
          </span>
        )}
      </div>

      {loading && (
        <div className="tournaments-empty">Loading tournaments…</div>
      )}

      {error && (
        <div className="tournaments-empty">
          <p>Could not load tournaments.</p>
          <p className="text-xs mt-2">{error}</p>
        </div>
      )}

      {data && data.tournaments.length === 0 && (
        <div className="tournaments-empty">
          <p>No tournaments found.</p>
          {data.source === "db" && (
            <p className="text-xs mt-2">
              Receive a webhook event to register a tournament here.
              Set <code>TOPDECK_API_KEY</code> to list from the TopDeck API.
            </p>
          )}
        </div>
      )}

      {data && data.tournaments.length > 0 && (
        <div className="tournaments-grid">
          {data.tournaments.map((t) => {
            const tid = getTid(t);
            const status = getStatus(t);
            const isExpanded = expandedTid === tid;

            return (
              <div key={tid} className="tournament-card">
                {/* Header image or gradient bar */}
                {(t as TopDeckMyTournament).headerImage ? (
                  <img
                    src={(t as TopDeckMyTournament).headerImage!}
                    alt={t.name}
                    className="tournament-card-header-img"
                  />
                ) : (
                  <div className="tournament-card-header-placeholder" />
                )}

                <div className="tournament-card-body">
                  <div className="tournament-card-name">{t.name}</div>
                  <div className="tournament-card-meta">
                    <span className={`status-badge ${STATUS_CLASS[status] ?? "not-started"}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                    <span className="meta-pill">{t.game}</span>
                    <span className="meta-pill">{t.format}</span>
                  </div>
                  <div className="tournament-card-date">
                    📅 {formatDate(t.startDate ?? null)}
                    {(t as TournamentSummary).participantCount != null && (
                      <> · {(t as TournamentSummary).participantCount} players</>
                    )}
                  </div>
                </div>

                <div className="tournament-card-footer">
                  <Link href={`/dashboard/${tid}`} className="btn-primary">
                    Live Coverage
                  </Link>
                  <button
                    className="btn-secondary"
                    onClick={() => setExpandedTid(isExpanded ? null : tid)}
                  >
                    {isExpanded ? "Hide Overlays" : "OBS Overlays"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="tournament-card-overlays">
                    <OverlayLinksPopover tid={tid} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

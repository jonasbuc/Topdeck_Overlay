/**
 * VenueDisplay — auto-rotating big-screen display for venue projectors.
 *
 * Cycles through up to four scenes with a smooth 0.8s opacity fade:
 *   1. Clock       — big round countdown + round label
 *   2. Pairings    — 2-column grid of current tables
 *   3. Standings   — 2-column grid of top standings
 *   4. Feature     — auto-selected feature match (only if an Active table exists)
 *
 * Props:
 *   state            — live tournament state (null = loading)
 *   sceneDurationMs  — how long each scene is shown (default 12 000 ms)
 *
 * Recommended OBS / projector setup:
 *   Set browser source to the venue display resolution (e.g. 1920×1080 or 3840×2160).
 *   No transparency needed — the root background is solid dark.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { RoundClock } from "@/components/RoundClock";
import { resolveFeatureTable } from "@/components/overlays/FeatureMatch";
import type { LiveTournamentState } from "@/lib/topdeck/types";
import type {
  TournamentAnnouncementDTO,
  TournamentFloorMapDTO,
} from "@/lib/event-ops/types";

type SceneId =
  | "clock"
  | "pairings"
  | "standings"
  | "heatmap"
  | "schedule"
  | "floor"
  | "feature";
const BASE_SCENES: SceneId[] = [
  "clock",
  "pairings",
  "standings",
  "heatmap",
  "schedule",
  "floor",
  "feature",
];

interface Props {
  tid: string;
  state: LiveTournamentState | null;
  sceneDurationMs?: number;
  accessibility?: boolean;
}

interface AnnouncementResponse {
  announcements: TournamentAnnouncementDTO[];
}

interface FloorMapResponse {
  floorMap: TournamentFloorMapDTO;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ClockScene({ state }: { state: LiveTournamentState | null }) {
  return (
    <div className="venue-clock-scene">
      <div className="venue-round-big">
        {state?.roundLabel ||
          (state?.currentRound ? `Round ${state.currentRound}` : "Waiting…")}
      </div>
      <RoundClock
        startedAt={state?.roundStartedAt ?? null}
        roundTimeMinutes={state?.roundTimeMinutes ?? null}
        roundStatus={state?.roundStatus ?? "pending"}
      />
    </div>
  );
}

function PairingsScene({ state }: { state: LiveTournamentState | null }) {
  const tables = (state?.tables ?? []).filter((t) => t.table !== "Byes").slice(0, 20);

  return (
    <>
      <p className="venue-scene-title">Current Pairings</p>
      {tables.length === 0 ? (
        <p className="venue-empty">Waiting for pairings…</p>
      ) : (
        <div className="venue-pairings-grid">
          {tables.map((t) => {
            const isDraw = t.winner_id === "Draw";
            const rowClass =
              t.status === "Active" ? "active"
              : t.status === "Completed" ? "completed"
              : "";
            return (
              <div key={String(t.table)} className={`venue-pairing-row ${rowClass}`}>
                <span className="venue-table-num">{t.table}</span>
                <span className="venue-pairing-players">
                  {t.players.map((p) => p.name).join(" · ")}
                </span>
                {t.status === "Completed" && (
                  <span className={`venue-pairing-result ${isDraw ? "draw" : "win"}`}>
                    {isDraw ? "Draw" : t.winner ?? ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StandingsScene({ state }: { state: LiveTournamentState | null }) {
  const standings = (state?.standings ?? []).slice(0, 16);

  return (
    <>
      <p className="venue-scene-title">Standings</p>
      {standings.length === 0 ? (
        <p className="venue-empty">Pending first round end…</p>
      ) : (
        <div className="venue-standings-grid">
          {standings.map((s) => (
            <div key={s.id} className="venue-standing-row">
              <span className="venue-standing-rank">
                {s.standing === 1 ? "🏆" : s.standing}
              </span>
              <span className="venue-standing-name">{s.name}</span>
              <span className="venue-standing-pts">{s.points}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FeatureScene({ state }: { state: LiveTournamentState | null }) {
  if (!state) return null;
  const table = resolveFeatureTable(state.tables);
  if (!table) return null;

  const isDraw = table.winner_id === "Draw";
  const isComplete = table.status === "Completed";

  return (
    <>
      <p className="venue-scene-title">Feature Match</p>
      <div className="feature-match-root">
        <div className="feature-match-header">
          <span className="feature-match-label">Table {table.table}</span>
          <span className="feature-match-table-num">
            {state.roundLabel || `Round ${state.currentRound}`}
          </span>
        </div>
        <div className="feature-match-players">
          {table.players.map((p) => {
            const isWinner = isComplete && !isDraw && table.winner_id === p.id;
            return (
              <div
                key={p.id}
                className={`feature-match-player${isWinner ? " winner" : ""}${isComplete && isDraw ? " draw" : ""}`}
              >
                <span className="feature-match-player-name">{p.name}</span>
                {isWinner && (
                  <span className="feature-match-result-badge win">Winner</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FloorScene({ floorMap }: { floorMap: TournamentFloorMapDTO | null }) {
  const zones = floorMap?.zones ?? [];

  return (
    <>
      <p className="venue-scene-title">{floorMap?.title ?? "Venue Map"}</p>
      {zones.length === 0 ? (
        <p className="venue-empty">Floor map not configured…</p>
      ) : (
        <div className="venue-floor-grid">
          {zones.map((zone) => (
            <div key={zone.id} className="venue-floor-zone">
              <span>Tables {zone.tableStart}-{zone.tableEnd}</span>
              <strong>{zone.label}</strong>
              {zone.detail && <p>{zone.detail}</p>}
            </div>
          ))}
        </div>
      )}
      {floorMap?.notes && <p className="venue-floor-note">{floorMap.notes}</p>}
    </>
  );
}

function HeatmapScene({
  state,
  floorMap,
}: {
  state: LiveTournamentState | null;
  floorMap: TournamentFloorMapDTO | null;
}) {
  const zones = floorMap?.zones ?? [];
  const tables = state?.tables ?? [];
  const rows = zones.map((zone) => {
    const zoneTables = tables.filter(
      (table) =>
        typeof table.table === "number" &&
        table.table >= zone.tableStart &&
        table.table <= zone.tableEnd
    );
    const active = zoneTables.filter((table) => table.status === "Active").length;
    const done = zoneTables.filter((table) => table.status === "Completed").length;
    const pending = zoneTables.filter((table) => table.status === "Pending").length;
    return { zone, active, done, pending, total: zoneTables.length };
  });

  return (
    <>
      <p className="venue-scene-title">Table Zone Heatmap</p>
      {rows.length === 0 ? (
        <p className="venue-empty">Floor map not configured…</p>
      ) : (
        <div className="venue-heatmap-grid">
          {rows.map((row) => (
            <div key={row.zone.id} className={row.active > 0 ? "active" : "quiet"}>
              <span>Tables {row.zone.tableStart}-{row.zone.tableEnd}</span>
              <strong>{row.zone.label}</strong>
              <p>{row.active} active · {row.done} done · {row.pending} pending</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ScheduleScene({ state }: { state: LiveTournamentState | null }) {
  const start = state?.startDate ? new Date(state.startDate) : null;
  const items = [
    { label: "Check-in", detail: start ? start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Before event" },
    { label: "Player meeting", detail: "Before Round 1" },
    { label: "Current round", detail: state?.roundLabel || "Waiting" },
    { label: "Lunch / break", detail: "TO announcement" },
    { label: "Top cut", detail: "After Swiss" },
    { label: "Finals", detail: "End of event" },
  ];

  return (
    <>
      <p className="venue-scene-title">Schedule Timeline</p>
      <div className="venue-schedule-timeline">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.detail}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function VenueAnnouncementOverlay({
  announcement,
}: {
  announcement: TournamentAnnouncementDTO | null;
}) {
  if (!announcement) return null;

  return (
    <div className={`venue-announcement-overlay ${announcement.tone}`}>
      <span>Announcement</span>
      <strong>{announcement.title}</strong>
      <p>{announcement.body}</p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function VenueDisplay({
  tid,
  state,
  sceneDurationMs = 12_000,
  accessibility = false,
}: Props) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [announcements, setAnnouncements] = useState<TournamentAnnouncementDTO[]>([]);
  const [floorMap, setFloorMap] = useState<TournamentFloorMapDTO | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`/api/tournaments/${tid}/announcements?audience=venue`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: AnnouncementResponse | null) =>
          setAnnouncements(data?.announcements ?? [])
        )
        .catch(() => setAnnouncements([]));

      fetch(`/api/tournaments/${tid}/floor-map`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: FloorMapResponse | null) =>
          setFloorMap(data?.floorMap ?? null)
        )
        .catch(() => setFloorMap(null));
    };

    load();
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, [tid]);

  // Only include the feature scene when an Active table exists
  const hasActiveTable =
    state?.tables.some((t) => t.table !== "Byes" && t.status === "Active") ?? false;
  const hasFloorMap = (floorMap?.zones.length ?? 0) > 0;
  const scenes = BASE_SCENES.filter((s) => {
    if (s === "feature") return hasActiveTable;
    if (s === "floor") return hasFloorMap;
    return true;
  });

  useEffect(() => {
    if (scenes.length <= 1) return;
    const id = setInterval(
      () => setSceneIdx((prev) => (prev + 1) % scenes.length),
      sceneDurationMs
    );
    return () => clearInterval(id);
  }, [scenes.length, sceneDurationMs]);

  const currentScene = scenes[sceneIdx % scenes.length] ?? "clock";

  return (
    <div className={`venue-root${accessibility ? " accessibility-view" : ""}`}>
      {/* Fixed header */}
      {state && (
        <div className="venue-header">
          <span className="venue-tournament-name">{state.name}</span>
          <span className="venue-round-label">
            {state.roundLabel ||
              (state.currentRound > 0 ? `Round ${state.currentRound}` : "—")}
          </span>
        </div>
      )}

      {/* Scenes — all rendered, only active one is visible */}
      <div className={`venue-scene ${currentScene === "clock" ? "active" : "inactive"}`}>
        <ClockScene state={state} />
      </div>

      <div className={`venue-scene ${currentScene === "pairings" ? "active" : "inactive"}`}>
        <PairingsScene state={state} />
      </div>

      <div className={`venue-scene ${currentScene === "standings" ? "active" : "inactive"}`}>
        <StandingsScene state={state} />
      </div>

      <div className={`venue-scene ${currentScene === "heatmap" ? "active" : "inactive"}`}>
        <HeatmapScene state={state} floorMap={floorMap} />
      </div>

      <div className={`venue-scene ${currentScene === "schedule" ? "active" : "inactive"}`}>
        <ScheduleScene state={state} />
      </div>

      {hasFloorMap && (
        <div className={`venue-scene ${currentScene === "floor" ? "active" : "inactive"}`}>
          <FloorScene floorMap={floorMap} />
        </div>
      )}

      {hasActiveTable && (
        <div className={`venue-scene ${currentScene === "feature" ? "active" : "inactive"}`}>
          <FeatureScene state={state} />
        </div>
      )}

      {/* Progress dots */}
      <div className="venue-dots">
        {scenes.map((s, i) => (
          <div
            key={s}
            className={`venue-dot${i === sceneIdx % scenes.length ? " active" : ""}`}
          />
        ))}
      </div>

      <VenueAnnouncementOverlay announcement={announcements[0] ?? null} />
    </div>
  );
}

export function VenueKioskMode({
  tid,
  state,
  accessibility = false,
}: {
  tid: string;
  state: LiveTournamentState | null;
  accessibility?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [floorMap, setFloorMap] = useState<TournamentFloorMapDTO | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tid}/floor-map`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FloorMapResponse | null) => setFloorMap(data?.floorMap ?? null))
      .catch(() => setFloorMap(null));
  }, [tid]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!state || !needle) return [];
    return state.tables
      .flatMap((table) =>
        table.players.map((player) => ({
          player,
          table,
          zone: floorMap?.zones.find(
            (zone) =>
              typeof table.table === "number" &&
              table.table >= zone.tableStart &&
              table.table <= zone.tableEnd
          ),
        }))
      )
      .filter((entry) => entry.player.name.toLowerCase().includes(needle))
      .slice(0, 10);
  }, [floorMap?.zones, query, state]);

  return (
    <div className={`venue-kiosk-root${accessibility ? " accessibility-view" : ""}`}>
      <header className="venue-kiosk-header">
        <div>
          <span>Venue Kiosk</span>
          <h1>{state?.name || `Tournament ${tid}`}</h1>
        </div>
        <strong>{state?.roundLabel || "Waiting"}</strong>
      </header>

      <main className="venue-kiosk-grid">
        <section className="venue-kiosk-search">
          <h2>Find Player / Table</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player name"
            autoFocus
          />
          <div className="venue-kiosk-results">
            {matches.length === 0 && <p>Search for a player to find their table.</p>}
            {matches.map((entry) => (
              <div key={`${entry.player.id}-${entry.table.table}`}>
                <span>{entry.player.name}</span>
                <strong>
                  {entry.table.table === "Byes" ? "Bye" : `Table ${entry.table.table}`}
                </strong>
                <p>{entry.zone ? entry.zone.label : "Zone not mapped"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="venue-kiosk-panel">
          <HeatmapScene state={state} floorMap={floorMap} />
        </section>

        <section className="venue-kiosk-panel">
          <ScheduleScene state={state} />
        </section>
      </main>
    </div>
  );
}

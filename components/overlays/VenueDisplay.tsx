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

import { useEffect, useState } from "react";
import { RoundClock } from "@/components/RoundClock";
import { resolveFeatureTable } from "@/components/overlays/FeatureMatch";
import type { LiveTournamentState } from "@/lib/topdeck/types";

type SceneId = "clock" | "pairings" | "standings" | "feature";
const BASE_SCENES: SceneId[] = ["clock", "pairings", "standings", "feature"];

interface Props {
  state: LiveTournamentState | null;
  sceneDurationMs?: number;
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

// ─── Main component ────────────────────────────────────────────────────────

export function VenueDisplay({ state, sceneDurationMs = 12_000 }: Props) {
  const [sceneIdx, setSceneIdx] = useState(0);

  // Only include the feature scene when an Active table exists
  const hasActiveTable =
    state?.tables.some((t) => t.table !== "Byes" && t.status === "Active") ?? false;
  const scenes = BASE_SCENES.filter((s) => s !== "feature" || hasActiveTable);

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
    <div className="venue-root">
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
    </div>
  );
}

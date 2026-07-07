"use client";

import { useTournamentLive } from "@/hooks/useTournamentLive";
import { RoundClock } from "@/components/RoundClock";
import { PairingsTable } from "@/components/PairingsTable";
import { MatchResultsFeed } from "@/components/MatchResultsFeed";
import { LiveStandings } from "@/components/LiveStandings";
import { PlayerRoster } from "@/components/PlayerRoster";
import { DroppedPlayers } from "@/components/DroppedPlayers";
import { WinnerScreen } from "@/components/WinnerScreen";
import { TournamentInfoBanner } from "@/components/TournamentInfoBanner";
import { RoundHistoryViewer } from "@/components/RoundHistoryViewer";
import { ParkingSection } from "@/components/ParkingSection";
import { TournamentOpsPanel } from "@/components/TournamentOpsPanel";
import { DiscordSetupWizard } from "@/components/DiscordSetupWizard";
import { EventOperationsPanel } from "@/components/EventOperationsPanel";
import Link from "next/link";

interface Props {
  params: { tid: string };
}

export default function DashboardPage({ params }: Props) {
  const { tid } = params;
  const { state, connected, error } = useTournamentLive(tid);

  return (
    <div className="min-h-screen page-bg">
      {/* Winner overlay (fullscreen, shown on top) */}
      {state?.finished && (
        <WinnerScreen
          winner={state.winner}
          tournamentName={state.name}
          participantCount={state.participantCount}
          tid={tid}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ── Tournament info banner (REST-enriched data) ────────────────── */}
        {state && <TournamentInfoBanner state={state} />}

        {/* ── Parking near venue (shown when location is available) ───────── */}
        {state?.location && (
          <ParkingSection tid={tid} location={state.location} />
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="dashboard-header">
          <div>
            <h1 className="tournament-title">
              {state?.name || `Tournament ${tid}`}
            </h1>
            <div className="tournament-meta">
              {state?.game && <span className="meta-pill">{state.game}</span>}
              {state?.format && <span className="meta-pill">{state.format}</span>}
              {state?.currentStage !== undefined && state.currentStage > 0 && (
                <span className="meta-pill">Stage {state.currentStage}</span>
              )}
              {state?.roundLabel && (
                <span className="meta-pill">
                  {/^\d+$/.test(state.roundLabel) ? `Round ${state.roundLabel}` : state.roundLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection indicator */}
            <div className="status-bar">
              <div
                className={`status-dot ${error ? "error" : connected ? "connected" : ""}`}
              />
              <span>{error ?? (connected ? "Live" : "Connecting…")}</span>
            </div>

            {/* Overlay sources link */}
            <Link href={`/overlay/${tid}`} target="_blank" className="obs-link">
              OBS overlays ↗
            </Link>

            {/* Player companion link */}
            <Link href={`/event/${tid}`} target="_blank" className="obs-link">
              Player page ↗
            </Link>

            {/* Analytics link */}
            <Link href={`/analytics/${tid}`} className="obs-link">
              Analytics
            </Link>

            <Link href={`/judge/${tid}`} className="obs-link">
              Judge
            </Link>

            <Link href={`/to/${tid}`} className="obs-link">
              TO
            </Link>

            <Link href={`/producer/${tid}`} className="obs-link">
              Producer
            </Link>
          </div>
        </div>

        {/* ── Finished tournament banner ──────────────────────────────────── */}
        {state?.finished && (
          <div className="finished-banner">
            <div className="finished-banner-left">
              <span className="finished-banner-trophy">🏆</span>
              <div>
                <div className="finished-banner-label">Tournament Complete</div>
                <div className="finished-banner-winner">
                  {state.winner?.name ?? "—"} · {state.participantCount} players
                </div>
              </div>
            </div>
            <Link href={`/analytics/${tid}`} className="finished-banner-btn">
              View Full Stats &amp; Results →
            </Link>
          </div>
        )}

        {state && (
          <div className="ops-dashboard-grid">
            <TournamentOpsPanel tid={tid} />
            <DiscordSetupWizard tid={tid} />
          </div>
        )}

        {state && <EventOperationsPanel tid={tid} />}

        {/* ── Overlay sources panel ───────────────────────────────────────── */}
        {state && (
          <details className="card">
            <summary className="overlay-links-summary overlay-links-title">
              OBS Overlay Sources ▾
            </summary>
            <div className="overlay-links-panel-spaced">
              {[
                { name: "Full composite (1920×1080)", path: `/overlay/${tid}/full` },
                { name: "Full overlay — legacy", path: `/overlay/${tid}` },
                { name: "Clock only (600×300)", path: `/overlay/${tid}/clock` },
                { name: "Pairings table (640×900)", path: `/overlay/${tid}/pairings` },
                { name: "Standings strip (400×900)", path: `/overlay/${tid}/standings` },
                { name: "Lower third (1920×120)", path: `/overlay/${tid}/lower-third` },
                { name: "Feature match auto (1920×300)", path: `/overlay/${tid}/feature` },
                { name: "Feature match table 1 (1920×300)", path: `/overlay/${tid}/feature/1` },
                { name: "Winner screen (1920×1080)", path: `/overlay/${tid}/winner` },
                { name: "Results ticker (1920×64)", path: `/overlay/${tid}/ticker` },
                { name: "Venue display (fullscreen)", path: `/venue/${tid}` },
                { name: "Player companion page", path: `/event/${tid}` },
                { name: "TO command center", path: `/to/${tid}` },
                { name: "Judge console", path: `/judge/${tid}` },
                { name: "Producer mode", path: `/producer/${tid}` },
                { name: "Event recap", path: `/recap/${tid}` },
              ].map((o) => (
                <div key={o.path} className="overlay-link-row">
                  <span className="overlay-link-name">{o.name}</span>
                  <span className="overlay-link-url">{o.path}</span>
                  <Link href={o.path} target="_blank" className="overlay-link-open">↗</Link>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Loading state ───────────────────────────────────────────────── */}
        {!state && (
          <div className="waiting-card">
            <p>Waiting for tournament data…</p>
            <p className="text-xs mt-2">
              Send a webhook event for <code>{tid}</code> to see live coverage.
            </p>
          </div>
        )}

        {state && (
          <>
            {/* ── Round clock (full-width) ─────────────────────────────────── */}
            <div className="round-section">
              <p className="round-section-label">
                {state.roundLabel || `Round ${state.currentRound}`}
              </p>
              <RoundClock
                startedAt={state.roundStartedAt}
                roundTimeMinutes={state.roundTimeMinutes}
                roundStatus={state.roundStatus}
              />
            </div>

            {/* ── Two-column grid ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PairingsTable
                tables={state.tables}
                roundLabel={state.roundLabel}
              />
              <MatchResultsFeed results={state.matchResults} />
            </div>

            {/* ── Standings (full-width) ───────────────────────────────────── */}
            <LiveStandings standings={state.standings} />

            {/* ── Players + dropped ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PlayerRoster
                  players={state.players}
                  droppedPlayers={state.droppedPlayers}
                />
              </div>
              <DroppedPlayers droppedPlayers={state.droppedPlayers} />
            </div>

            {/* ── Round history ─────────────────────────────────────────────── */}
            <RoundHistoryViewer roundHistory={state.roundHistory ?? []} />
          </>
        )}
      </div>
    </div>
  );
}

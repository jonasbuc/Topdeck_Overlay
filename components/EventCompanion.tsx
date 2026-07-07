"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { ParkingSection } from "@/components/ParkingSection";
import { RoundClock } from "@/components/RoundClock";
import {
  EventAnnouncementBanner,
  PlayerJudgeCallForm,
  PublicFloorMap,
} from "@/components/EventOpsPublic";
import type {
  LiveTournamentState,
  TopDeckPlayer,
  TopDeckStanding,
  TopDeckTable,
} from "@/lib/topdeck/types";

interface Props {
  tid: string;
}

interface PlayerOption {
  id: string;
  name: string;
  standing: number | null;
  points: number | null;
  dropped: boolean;
}

interface DiscordSnapshot {
  linked: boolean;
  link: {
    guildId: string;
    channelId: string;
  } | null;
}

type TableStatusFilter = "all" | "active" | "pending" | "completed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function playerKey(player: Pick<TopDeckPlayer, "id" | "name">): string {
  return player.id || normalize(player.name);
}

function samePlayer(
  player: Pick<TopDeckPlayer, "id" | "name">,
  option: PlayerOption
): boolean {
  return playerKey(player) === option.id || normalize(player.name) === normalize(option.name);
}

function formatRoundLabel(state: LiveTournamentState): string {
  if (state.roundLabel) {
    return /^\d+$/.test(state.roundLabel)
      ? `Round ${state.roundLabel}`
      : state.roundLabel;
  }
  return state.currentRound > 0 ? `Round ${state.currentRound}` : "Waiting";
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== "number") return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function collectPlayers(state: LiveTournamentState): PlayerOption[] {
  const droppedIds = new Set(state.droppedPlayers.map((entry) => entry.player.id));
  const standingsById = new Map<string, TopDeckStanding>();
  for (const standing of state.standings) standingsById.set(standing.id, standing);

  const players = new Map<string, PlayerOption>();
  const add = (player: Pick<TopDeckPlayer, "id" | "name">) => {
    const id = playerKey(player);
    const standing = standingsById.get(player.id);
    if (!players.has(id)) {
      players.set(id, {
        id,
        name: player.name,
        standing: standing?.standing ?? null,
        points: standing?.points ?? null,
        dropped: droppedIds.has(player.id),
      });
    }
  };

  state.players.forEach(add);
  state.tables.flatMap((table) => table.players).forEach(add);
  state.standings.forEach((standing) =>
    add({ id: standing.id, name: standing.name })
  );

  return [...players.values()].sort((a, b) => {
    if (a.standing != null && b.standing != null) return a.standing - b.standing;
    if (a.standing != null) return -1;
    if (b.standing != null) return 1;
    return a.name.localeCompare(b.name);
  });
}

function findPlayerTable(
  state: LiveTournamentState,
  player: PlayerOption | null
): TopDeckTable | null {
  if (!player) return null;
  return (
    state.tables.find((table) =>
      table.players.some((tablePlayer) => samePlayer(tablePlayer, player))
    ) ?? null
  );
}

function getTableResult(table: TopDeckTable): string {
  if (table.status === "Bye") return "Bye";
  if (table.status !== "Completed") return table.status;
  if (table.winner_id === "Draw") return "Draw";
  return table.winner ? `${table.winner} won` : "Completed";
}

function discordChannelUrl(discord: DiscordSnapshot | null): string | null {
  if (!discord?.link) return null;
  return `https://discord.com/channels/${discord.link.guildId}/${discord.link.channelId}`;
}

function copyTableSummary(table: TopDeckTable): Promise<void> {
  const players = table.players.map((player) => player.name).join(" vs ");
  const tableLabel = table.table === "Byes" ? "Byes" : `Table ${table.table}`;
  return navigator.clipboard.writeText(`${tableLabel}: ${players}`);
}

function EventTableCard({
  table,
  selected,
  onCopy,
}: {
  table: TopDeckTable;
  selected?: boolean;
  onCopy?: (table: TopDeckTable) => void;
}) {
  const status = table.status.toLowerCase();
  return (
    <article className={`event-table-card ${status}${selected ? " selected" : ""}`}>
      <div className="event-table-card-top">
        <div>
          <div className="event-table-label">
            {table.table === "Byes" ? "Byes" : `Table ${table.table}`}
          </div>
          {table.match && <div className="event-table-match">{table.match}</div>}
        </div>
        <span className={`event-table-status ${status}`}>
          {getTableResult(table)}
        </span>
      </div>

      <div className="event-table-players">
        {table.players.map((player) => (
          <div
            key={`${table.table}-${player.id}-${player.name}`}
            className={`event-table-player ${
              table.winner_id === player.id ? "winner" : ""
            }`}
          >
            {player.name}
          </div>
        ))}
      </div>

      {onCopy && table.table !== "Byes" && (
        <button
          type="button"
          className="event-copy-table-btn"
          onClick={() => onCopy(table)}
        >
          Copy table
        </button>
      )}
    </article>
  );
}

export function EventCompanion({ tid }: Props) {
  const { state, connected, error } = useTournamentLive(tid);
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<TableStatusFilter>("all");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [discord, setDiscord] = useState<DiscordSnapshot | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const playerStorageKey = `topdeck-live:${tid}:event-player`;

  useEffect(() => {
    try {
      setSelectedPlayerId(localStorage.getItem(playerStorageKey));
    } catch {
      setSelectedPlayerId(null);
    }
  }, [playerStorageKey]);

  useEffect(() => {
    fetch(`/api/tournaments/${tid}/discord`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DiscordSnapshot | null) => setDiscord(data))
      .catch(() => setDiscord(null));
  }, [tid]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const players = useMemo(() => (state ? collectPlayers(state) : []), [state]);
  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedTable = state ? findPlayerTable(state, selectedPlayer) : null;
  const selectedStanding =
    state && selectedPlayer
      ? state.standings.find(
          (standing) =>
            standing.id === selectedPlayer.id ||
            normalize(standing.name) === normalize(selectedPlayer.name)
        ) ?? null
      : null;

  const searchMatches = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return players.slice(0, 6);
    return players
      .filter((player) => normalize(player.name).includes(needle))
      .slice(0, 8);
  }, [players, query]);

  const filteredTables = useMemo(() => {
    if (!state) return [];
    const needle = normalize(query);
    return state.tables.filter((table) => {
      if (tableFilter !== "all") {
        const status =
          table.status === "Completed"
            ? "completed"
            : table.status === "Pending"
            ? "pending"
            : "active";
        if (status !== tableFilter) return false;
      }
      if (!needle) return true;
      return table.players.some((player) => normalize(player.name).includes(needle));
    });
  }, [query, state, tableFilter]);

  const channelUrl = discordChannelUrl(discord);

  const selectPlayer = (player: PlayerOption) => {
    setSelectedPlayerId(player.id);
    setQuery(player.name);
    try {
      localStorage.setItem(playerStorageKey, player.id);
    } catch {
      // Remembering the player is a convenience only.
    }
  };

  const clearPlayer = () => {
    setSelectedPlayerId(null);
    setQuery("");
    try {
      localStorage.removeItem(playerStorageKey);
    } catch {
      // Ignore localStorage failures.
    }
  };

  const handleCopyTable = (table: TopDeckTable) => {
    copyTableSummary(table)
      .then(() => {
        setCopyMessage("Copied");
        window.setTimeout(() => setCopyMessage(null), 1400);
      })
      .catch(() => {
        setCopyMessage("Copy failed");
        window.setTimeout(() => setCopyMessage(null), 1800);
      });
  };

  const installApp = () => {
    if (!installPrompt) return;
    installPrompt.prompt().catch(() => {});
    installPrompt.userChoice.finally(() => setInstallPrompt(null));
  };

  if (!state) {
    return (
      <div className="event-page">
        <main className="event-shell">
          <div className="event-loading-panel">
            <div className="status-bar">
              <span className={`status-dot ${error ? "error" : connected ? "connected" : ""}`} />
              <span>{error ?? (connected ? "Live" : "Connecting...")}</span>
            </div>
            <h1>Tournament {tid}</h1>
            <p>Waiting for tournament data.</p>
          </div>
        </main>
      </div>
    );
  }

  const completedCount = state.tables.filter((table) => table.status === "Completed").length;
  const activeCount = state.tables.filter((table) => table.status === "Active").length;
  const pendingCount = state.tables.filter((table) => table.status === "Pending").length;

  return (
    <div className="event-page">
      <header
        className={`event-hero ${state.headerImage ? "with-image" : ""}`}
        style={
          state.headerImage
            ? { backgroundImage: `url(${state.headerImage})` }
            : undefined
        }
      >
        <div className="event-hero-shade" />
        <div className="event-hero-content">
          <div className="event-hero-top">
            <div className="status-bar">
              <span className={`status-dot ${error ? "error" : connected ? "connected" : ""}`} />
              <span>{error ?? (connected ? "Live" : "Connecting...")}</span>
            </div>
            {channelUrl && (
              <a className="event-discord-link" href={channelUrl} target="_blank" rel="noreferrer">
                Discord
              </a>
            )}
            {state.finished && (
              <Link className="event-discord-link" href={`/recap/${tid}`}>
                Recap
              </Link>
            )}
            {installPrompt && (
              <button type="button" className="event-install-btn" onClick={installApp}>
                Install
              </button>
            )}
          </div>

          <h1>{state.name || `Tournament ${tid}`}</h1>
          <div className="event-meta-row">
            {state.game && <span>{state.game}</span>}
            {state.format && <span>{state.format}</span>}
            <span>{formatRoundLabel(state)}</span>
            <span>{state.finished ? "Finished" : state.status}</span>
          </div>
        </div>
      </header>

      <main className="event-shell">
        <nav className="event-jump-nav" aria-label="Event sections">
          <a href="#player">Player</a>
          <a href="#judge">Judge</a>
          <a href="#pairings">Pairings</a>
          <a href="#standings">Standings</a>
          <a href="#floor-map">Map</a>
          {state.location && <a href="#parking">Parking</a>}
        </nav>

        <EventAnnouncementBanner tid={tid} />

        <section className="event-round-panel">
          <div className="event-round-copy">
            <span>{formatRoundLabel(state)}</span>
            <strong>{state.roundStatus}</strong>
          </div>
          <RoundClock
            startedAt={state.roundStartedAt}
            roundTimeMinutes={state.roundTimeMinutes}
            roundStatus={state.roundStatus}
          />
        </section>

        {state.finished && (
          <section className="event-panel event-winner-panel">
            <span>Tournament complete</span>
            <strong>{state.winner?.name ?? "Winner pending"}</strong>
            <Link href={`/analytics/${tid}`}>Final stats</Link>
          </section>
        )}

        <section id="player" className="event-panel">
          <div className="event-panel-header">
            <h2>Find Player</h2>
            {selectedPlayer && (
              <button type="button" className="event-ghost-btn" onClick={clearPlayer}>
                Clear
              </button>
            )}
          </div>

          <div className="event-search-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="event-search-input"
              placeholder="Player name"
              autoComplete="off"
            />
          </div>

          <div className="event-player-matches">
            {searchMatches.map((player) => (
              <button
                key={player.id}
                type="button"
                className={`event-player-chip ${
                  player.id === selectedPlayer?.id ? "selected" : ""
                }`}
                onClick={() => selectPlayer(player)}
              >
                <span>{player.name}</span>
                {player.standing != null && <strong>#{player.standing}</strong>}
              </button>
            ))}
          </div>

          {selectedPlayer && (
            <div className="event-player-summary">
              <div>
                <span className="event-kicker">Selected</span>
                <strong>{selectedPlayer.name}</strong>
              </div>
              <div className="event-player-stat-grid">
                <span>
                  Standing
                  <strong>
                    {selectedStanding ? `#${selectedStanding.standing}` : "-"}
                  </strong>
                </span>
                <span>
                  Points
                  <strong>{selectedStanding?.points ?? "-"}</strong>
                </span>
                <span>
                  Win
                  <strong>
                    {formatPercent(
                      selectedStanding?.successRate ?? selectedStanding?.winRate
                    )}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {selectedTable && (
            <div className="event-my-table">
              <span className="event-kicker">Current table</span>
              <EventTableCard
                table={selectedTable}
                selected
                onCopy={handleCopyTable}
              />
            </div>
          )}

          {selectedPlayer && !selectedTable && (
            <p className="event-muted-line">
              No active table found for {selectedPlayer.name}.
            </p>
          )}
        </section>

        <div id="judge">
          <PlayerJudgeCallForm
            tid={tid}
            selectedPlayer={selectedPlayer}
            selectedTable={selectedTable}
          />
        </div>

        <section id="pairings" className="event-panel">
          <div className="event-panel-header">
            <h2>Pairings</h2>
            <span className="event-count-pill">{state.tables.length}</span>
          </div>

          <div className="event-filter-row">
            {[
              ["all", `All ${state.tables.length}`],
              ["active", `Active ${activeCount}`],
              ["pending", `Pending ${pendingCount}`],
              ["completed", `Done ${completedCount}`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`event-filter-btn ${
                  tableFilter === key ? "active" : ""
                }`}
                onClick={() => setTableFilter(key as TableStatusFilter)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="event-table-grid">
            {filteredTables.map((table) => (
              <EventTableCard
                key={String(table.table)}
                table={table}
                selected={selectedTable?.table === table.table}
                onCopy={handleCopyTable}
              />
            ))}
          </div>
          {filteredTables.length === 0 && (
            <p className="event-muted-line">No tables match the current filter.</p>
          )}
          {copyMessage && <div className="event-copy-toast">{copyMessage}</div>}
        </section>

        <section id="standings" className="event-panel">
          <div className="event-panel-header">
            <h2>Standings</h2>
            <Link href={`/analytics/${tid}`} className="event-ghost-link">
              Analytics
            </Link>
          </div>

          {state.standings.length > 0 ? (
            <div className="event-standings-list">
              {state.standings.slice(0, 16).map((standing) => (
                <div
                  key={standing.id}
                  className={`event-standing-row ${
                    selectedPlayer &&
                    (standing.id === selectedPlayer.id ||
                      normalize(standing.name) === normalize(selectedPlayer.name))
                      ? "selected"
                      : ""
                  }`}
                >
                  <span className="event-standing-rank">#{standing.standing}</span>
                  <span className="event-standing-name">{standing.name}</span>
                  <strong>{standing.points}</strong>
                  <span>{formatPercent(standing.successRate ?? standing.winRate)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="event-muted-line">Standings will appear after round 1.</p>
          )}
        </section>

        <PublicFloorMap tid={tid} selectedTable={selectedTable} />

        {state.location && (
          <section id="parking" className="event-parking-wrap">
            <ParkingSection tid={tid} location={state.location} />
          </section>
        )}
      </main>
    </div>
  );
}

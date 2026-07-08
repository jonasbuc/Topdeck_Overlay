"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { ParkingSection } from "@/components/ParkingSection";
import { RoundClock } from "@/components/RoundClock";
import {
  EventAnnouncementBanner,
  PlayerHelpDeskForm,
  PlayerJudgeCallForm,
  PublicFloorMap,
} from "@/components/EventOpsPublic";
import {
  RoleExperienceShell,
  RoleWorkflowSection,
  useRolePreferences,
  type RoleAlert,
  type RoleCommandAction,
  type RoleStatusCard,
  type RoleTone,
  type RoleWorkflowTab,
} from "@/components/RoleExperienceShell";
import type {
  LiveTournamentState,
  TopDeckPlayer,
  TopDeckStanding,
  TopDeckTable,
} from "@/lib/topdeck/types";
import type { JudgeCallDTO } from "@/lib/event-ops/types";
import type { PlayerRequestDTO } from "@/lib/event-ops/types";

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

interface JudgeCallsResponse {
  calls: JudgeCallDTO[];
}

interface PlayerRequestsResponse {
  requests: PlayerRequestDTO[];
}

interface CardLookupResult {
  card: {
    id: string;
    name: string;
    printedName: string | null;
    manaCost: string | null;
    typeLine: string | null;
    oracleText: string | null;
    imageUrl: string | null;
    scryfallUri: string | null;
    legalities: Record<string, string>;
    rulings: Array<{
      publishedAt: string;
      comment: string;
    }>;
  };
}

type TableStatusFilter = "all" | "active" | "pending" | "completed";
type LocalResult = "win" | "loss" | "draw" | "drop" | null;

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

function getPlayerResult(table: TopDeckTable, player: PlayerOption | null): string {
  if (!player) return getTableResult(table);
  if (table.status === "Bye") return "Bye";
  if (table.status !== "Completed") return table.status;
  if (table.winner_id === "Draw") return "Draw";
  if (table.players.some((tablePlayer) => samePlayer(tablePlayer, player))) {
    return table.winner_id === player.id || normalize(table.winner ?? "") === normalize(player.name)
      ? "Win"
      : "Loss";
  }
  return getTableResult(table);
}

function opponentNames(table: TopDeckTable | null, player: PlayerOption | null): string {
  if (!table || !player) return "-";
  const opponents = table.players
    .filter((tablePlayer) => !samePlayer(tablePlayer, player))
    .map((tablePlayer) => tablePlayer.name);
  return opponents.length > 0 ? opponents.join(" / ") : "Bye";
}

function findStandingForPlayer(
  state: LiveTournamentState,
  player: Pick<PlayerOption, "id" | "name">
): TopDeckStanding | null {
  return (
    state.standings.find(
      (standing) =>
        standing.id === player.id || normalize(standing.name) === normalize(player.name)
    ) ?? null
  );
}

function collectCommanderCandidates(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectCommanderCandidates(item, depth + 1));
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const hits: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("commander") || lowered === "partner") {
      hits.push(...collectCommanderCandidates(child, depth + 1));
    } else if (depth < 2) {
      hits.push(...collectCommanderCandidates(child, depth + 1));
    }
  }
  return hits;
}

function commanderNamesForTable(
  state: LiveTournamentState,
  table: TopDeckTable | null
): string[] {
  if (!table) return [];
  const names = new Set<string>();
  for (const tablePlayer of table.players) {
    const standing = findStandingForPlayer(state, {
      id: tablePlayer.id,
      name: tablePlayer.name,
    });
    for (const name of collectCommanderCandidates(standing?.deckObj)) {
      const clean = name.trim();
      if (clean && clean.length <= 80) names.add(clean);
    }
  }
  return [...names].slice(0, 8);
}

function nextPlayerAction(
  state: LiveTournamentState,
  player: PlayerOption | null,
  table: TopDeckTable | null,
  activeJudgeCall: JudgeCallDTO | null
): { label: string; detail: string; tone: "ready" | "wait" | "urgent" } {
  if (!player) {
    return {
      label: "Select your player profile",
      detail: "Pick your name once to unlock table, standings and judge-call status.",
      tone: "wait",
    };
  }
  if (activeJudgeCall) {
    return {
      label:
        activeJudgeCall.status === "acknowledged"
          ? "Judge acknowledged"
          : "Judge request open",
      detail: activeJudgeCall.tableNumber
        ? `Table ${activeJudgeCall.tableNumber} · ${activeJudgeCall.category}`
        : activeJudgeCall.category,
      tone: activeJudgeCall.priority === "urgent" ? "urgent" : "wait",
    };
  }
  if (state.finished) {
    return {
      label: "Event complete",
      detail: "Check final standings and event recap.",
      tone: "ready",
    };
  }
  if (!table) {
    return {
      label: state.roundStatus === "pending" ? "Waiting for pairings" : "No active table",
      detail: "Keep the player page open; pairings update live.",
      tone: "wait",
    };
  }
  if (table.status === "Completed") {
    return {
      label: "Match complete",
      detail: `Recorded as ${getPlayerResult(table, player)}. Check standings after round end.`,
      tone: "ready",
    };
  }
  if (table.status === "Pending") {
    return {
      label: `Head to Table ${table.table}`,
      detail: `Opponent: ${opponentNames(table, player)}`,
      tone: "wait",
    };
  }
  return {
    label: `Playing at Table ${table.table}`,
    detail: `Opponent: ${opponentNames(table, player)}`,
    tone: "ready",
  };
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

function ResultSlipHelper({
  selectedPlayer,
  selectedTable,
  localResult,
  onChange,
}: {
  selectedPlayer: PlayerOption | null;
  selectedTable: TopDeckTable | null;
  localResult: LocalResult;
  onChange: (result: LocalResult) => void;
}) {
  const tableLabel =
    selectedTable && selectedTable.table !== "Byes" ? `Table ${selectedTable.table}` : "No table";
  const opponent = opponentNames(selectedTable, selectedPlayer);
  const reportText =
    !selectedPlayer || !selectedTable
      ? "Select your player profile first."
      : localResult === "win"
      ? `Report: ${selectedPlayer.name} won at ${tableLabel}`
      : localResult === "loss"
      ? `Report: opponent won at ${tableLabel}`
      : localResult === "draw"
      ? `Report: draw at ${tableLabel}`
      : localResult === "drop"
      ? `Ask TO to drop ${selectedPlayer.name} after this round`
      : `Choose a result for ${tableLabel}`;

  return (
    <section className="event-panel event-tool-panel">
      <div className="event-panel-header">
        <h2>Result Slip Helper</h2>
      </div>
      <div className="event-result-helper">
        <div>
          <span>{tableLabel}</span>
          <strong>{selectedPlayer?.name ?? "No player selected"}</strong>
          <p>Opponent: {opponent}</p>
        </div>
        <div className="event-result-actions">
          {[
            ["win", "Win"],
            ["loss", "Loss"],
            ["draw", "Draw"],
            ["drop", "Drop"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={localResult === value ? "active" : ""}
              onClick={() => onChange(value as LocalResult)}
              disabled={!selectedPlayer || !selectedTable}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="event-report-display">{reportText}</div>
      </div>
    </section>
  );
}

function CommanderLookup({
  tid,
  commanderCandidates,
}: {
  tid: string;
  commanderCandidates: string[];
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CardLookupResult["card"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (value = query) => {
    const clean = value.trim();
    if (!clean) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/judge/cards?query=${encodeURIComponent(clean)}`);
      const payload = (await res.json()) as CardLookupResult | { detail?: string };
      if (!res.ok || !("card" in payload)) {
        throw new Error("detail" in payload ? payload.detail : "Card not found");
      }
      setResult(payload.card);
      setQuery(payload.card.name);
    } catch (err) {
      setResult(null);
      setMessage(err instanceof Error ? err.message : "Card lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="event-panel event-card-lookup-panel">
      <div className="event-panel-header">
        <h2>Commander Lookup</h2>
        <Link href={`/judge/${tid}`} className="event-ghost-link">
          Judge tools
        </Link>
      </div>
      {commanderCandidates.length > 0 && (
        <div className="event-commander-chips">
          {commanderCandidates.map((name) => (
            <button key={name} type="button" onClick={() => search(name)}>
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="event-card-search-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Card or commander name"
        />
        <button type="button" onClick={() => search()} disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Lookup"}
        </button>
      </div>
      {message && <p className="event-muted-line">{message}</p>}
      {result && (
        <article className="event-card-result">
          {result.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.imageUrl} alt={result.name} />
          )}
          <div>
            <span>{result.manaCost ?? "No mana cost"}</span>
            <strong>{result.name}</strong>
            {result.printedName && <p>Printed name: {result.printedName}</p>}
            <p>{result.typeLine}</p>
            <p>{result.oracleText}</p>
            <div className="event-card-links">
              <span>
                Commander: {result.legalities.commander ?? "unknown"}
              </span>
              {result.scryfallUri && (
                <a href={result.scryfallUri} target="_blank" rel="noreferrer">
                  Oracle
                </a>
              )}
            </div>
            {result.rulings.length > 0 && (
              <div className="event-ruling-preview">
                <span>Latest ruling</span>
                <p>{result.rulings[0].comment}</p>
              </div>
            )}
          </div>
        </article>
      )}
    </section>
  );
}

function ReminderPanel({ state }: { state: LiveTournamentState }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    if (
      permission !== "granted" ||
      state.roundStatus !== "active" ||
      !state.roundStartedAt ||
      !state.roundTimeMinutes
    ) {
      return;
    }

    const roundEnd = state.roundStartedAt + state.roundTimeMinutes * 60_000;
    const fiveMinuteReminder = roundEnd - 5 * 60_000 - Date.now();
    if (fiveMinuteReminder <= 0) return;

    const id = window.setTimeout(() => {
      new Notification("5 minutes left", {
        body: `${formatRoundLabel(state)} is almost over.`,
      });
    }, fiveMinuteReminder);
    return () => window.clearTimeout(id);
  }, [permission, state]);

  const enable = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setMessage("Notifications are not supported in this browser.");
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    setMessage(
      next === "granted"
        ? "Round reminders enabled on this device."
        : "Notifications were not enabled."
    );
  };

  return (
    <section id="reminders" className="event-panel event-reminder-panel">
      <div className="event-panel-header">
        <h2>Reminders</h2>
      </div>
      <div className="event-reminder-grid">
        <div>
          <span>Pairings</span>
          <strong>{state.tables.length > 0 ? "Posted" : "Waiting"}</strong>
        </div>
        <div>
          <span>Timer</span>
          <strong>{state.roundStatus}</strong>
        </div>
        <div>
          <span>Notifications</span>
          <strong>{permission}</strong>
        </div>
      </div>
      <button
        type="button"
        className="event-ghost-btn"
        onClick={enable}
        disabled={permission === "granted" || permission === "unsupported"}
      >
        Enable device reminders
      </button>
      {message && <p className="event-muted-line">{message}</p>}
    </section>
  );
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
  const {
    activeTab: playerActiveTab,
    viewMode: playerViewMode,
    density: playerDensity,
    setActiveTab: setPlayerActiveTab,
    setViewMode: setPlayerViewMode,
    setDensity: setPlayerDensity,
  } = useRolePreferences(`topdeck-live:${tid}:player-ux`, "my-round");
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<TableStatusFilter>("all");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [discord, setDiscord] = useState<DiscordSnapshot | null>(null);
  const [judgeCalls, setJudgeCalls] = useState<JudgeCallDTO[]>([]);
  const [playerRequests, setPlayerRequests] = useState<PlayerRequestDTO[]>([]);
  const [localResult, setLocalResult] = useState<LocalResult>(null);
  const [accessibilityView, setAccessibilityView] = useState(false);
  const [autoOpenedPlayerAlert, setAutoOpenedPlayerAlert] = useState<string | null>(
    null
  );
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
    const load = () => {
      fetch(`/api/tournaments/${tid}/judge-calls`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: JudgeCallsResponse | null) => setJudgeCalls(data?.calls ?? []))
        .catch(() => setJudgeCalls([]));
    };
    load();
    const id = window.setInterval(load, 7000);
    return () => window.clearInterval(id);
  }, [tid]);

  useEffect(() => {
    const load = () => {
      fetch(`/api/tournaments/${tid}/player-requests`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PlayerRequestsResponse | null) =>
          setPlayerRequests(data?.requests ?? [])
        )
        .catch(() => setPlayerRequests([]));
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
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
  const selectedJudgeCalls = useMemo(() => {
    if (!selectedPlayer) return [];
    return judgeCalls.filter((call) => {
      const sameName =
        call.playerName != null &&
        normalize(call.playerName) === normalize(selectedPlayer.name);
      const sameTable =
        selectedTable?.table != null &&
        selectedTable.table !== "Byes" &&
        call.tableNumber === String(selectedTable.table);
      return sameName || sameTable;
    });
  }, [judgeCalls, selectedPlayer, selectedTable]);
  const activeJudgeCall =
    selectedJudgeCalls.find((call) => call.status !== "resolved") ?? null;
  const selectedPlayerRequests = useMemo(() => {
    if (!selectedPlayer) return [];
    return playerRequests.filter((request) => {
      const sameName =
        request.playerName != null &&
        normalize(request.playerName) === normalize(selectedPlayer.name);
      const sameTable =
        selectedTable?.table != null &&
        selectedTable.table !== "Byes" &&
        request.tableNumber === String(selectedTable.table);
      return sameName || sameTable;
    });
  }, [playerRequests, selectedPlayer, selectedTable]);
  const activePlayerRequest =
    selectedPlayerRequests.find((request) => request.status !== "resolved") ?? null;
  const commanderCandidates = state
    ? commanderNamesForTable(state, selectedTable)
    : [];

  useEffect(() => {
    const alertId = activeJudgeCall?.id ?? activePlayerRequest?.id ?? null;
    if (!alertId || alertId === autoOpenedPlayerAlert) return;
    setPlayerActiveTab("help");
    setAutoOpenedPlayerAlert(alertId);
  }, [
    activeJudgeCall?.id,
    activePlayerRequest?.id,
    autoOpenedPlayerAlert,
    setPlayerActiveTab,
  ]);

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
  const playerNextAction = nextPlayerAction(
    state,
    selectedPlayer,
    selectedTable,
    activeJudgeCall
  );
  const playerActionTone: RoleTone =
    playerNextAction.tone === "ready"
      ? "good"
      : playerNextAction.tone === "urgent"
      ? "danger"
      : "warning";
  const playerTabs: RoleWorkflowTab[] = [
    {
      id: "my-round",
      label: "My Round",
      detail: selectedTable
        ? selectedTable.table === "Byes"
          ? "Bye"
          : `Table ${selectedTable.table}`
        : "Find player",
      tone: selectedTable ? "good" : "warning",
    },
    {
      id: "pairings",
      label: "Pairings",
      detail: `${activeCount} active`,
      badge: state.tables.length,
      tone: pendingCount > 0 ? "warning" : "neutral",
    },
    {
      id: "help",
      label: "Help",
      detail: activeJudgeCall || activePlayerRequest ? "Open request" : "Clear",
      badge:
        (activeJudgeCall ? 1 : 0) + (activePlayerRequest ? 1 : 0) || undefined,
      tone: activeJudgeCall?.priority === "urgent" ? "danger" : "neutral",
    },
    {
      id: "venue",
      label: "Venue",
      detail: state.location ? "Map and parking" : "Map",
      tone: "neutral",
    },
  ];
  const playerStatusCards: RoleStatusCard[] = [
    {
      id: "round",
      label: "Round",
      value: formatRoundLabel(state),
      detail: state.roundStatus,
      tone: state.roundStatus === "active" ? "live" : "neutral",
      href: "#my-round",
      onSelect: () => setPlayerActiveTab("my-round"),
    },
    {
      id: "table",
      label: "My Table",
      value: selectedTable
        ? selectedTable.table === "Byes"
          ? "Bye"
          : `Table ${selectedTable.table}`
        : "-",
      detail: opponentNames(selectedTable, selectedPlayer),
      tone: selectedTable ? "good" : "warning",
      href: "#player",
      onSelect: () => setPlayerActiveTab("my-round"),
    },
    {
      id: "next",
      label: "Next Action",
      value: playerNextAction.label,
      detail: playerNextAction.detail,
      tone: playerActionTone,
      href: playerNextAction.tone === "urgent" ? "#judge" : "#my-round",
      onSelect: () =>
        setPlayerActiveTab(playerNextAction.tone === "urgent" ? "help" : "my-round"),
    },
    {
      id: "help",
      label: "Requests",
      value:
        activeJudgeCall || activePlayerRequest
          ? activeJudgeCall?.status ?? activePlayerRequest?.status ?? "Open"
          : "Clear",
      detail:
        activeJudgeCall?.category ??
        activePlayerRequest?.type ??
        "No judge or help request",
      tone: activeJudgeCall?.priority === "urgent" ? "danger" : "neutral",
      href: "#judge",
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "quick",
      label: "Quick Action",
      value: selectedPlayer ? "Call judge" : "Find player",
      detail: selectedPlayer
        ? selectedTable
          ? "Table is prefilled"
          : "Player is prefilled"
        : "Search once",
      tone: selectedPlayer ? "neutral" : "warning",
      href: selectedPlayer ? "#judge" : "#player",
      onSelect: () => setPlayerActiveTab(selectedPlayer ? "help" : "my-round"),
    },
  ];
  const playerAlerts: RoleAlert[] = [
    ...(activeJudgeCall
      ? [
          {
            id: `judge-${activeJudgeCall.id}`,
            label:
              activeJudgeCall.status === "acknowledged"
                ? "Judge acknowledged"
                : "Judge request open",
            detail: `${activeJudgeCall.priority} · ${activeJudgeCall.category}`,
            tone: activeJudgeCall.priority === "urgent" ? "danger" : "warning",
            href: "#judge",
            onSelect: () => setPlayerActiveTab("help"),
          } satisfies RoleAlert,
        ]
      : []),
    ...(activePlayerRequest
      ? [
          {
            id: `request-${activePlayerRequest.id}`,
            label: "Help request open",
            detail: `${activePlayerRequest.type} · ${activePlayerRequest.status}`,
            tone: activePlayerRequest.priority === "urgent" ? "danger" : "warning",
            href: "#help-desk",
            onSelect: () => setPlayerActiveTab("help"),
          } satisfies RoleAlert,
        ]
      : []),
  ];
  const playerActions: RoleCommandAction[] = [
    {
      id: "find-player",
      label: "Find player",
      detail: "Search player profile",
      href: "#player",
      keywords: ["search", "profile", "standing"],
      onSelect: () => setPlayerActiveTab("my-round"),
    },
    {
      id: "my-table",
      label: "My table",
      detail: selectedTable ? opponentNames(selectedTable, selectedPlayer) : "Select player",
      href: "#player",
      keywords: ["opponent", "round"],
      onSelect: () => setPlayerActiveTab("my-round"),
    },
    {
      id: "pairings",
      label: "Pairings",
      detail: `${state.tables.length} tables`,
      href: "#pairings-list",
      keywords: ["tables", "matches"],
      onSelect: () => setPlayerActiveTab("pairings"),
    },
    {
      id: "standings",
      label: "Standings",
      detail: "Live rank and points",
      href: "#standings",
      keywords: ["rank", "points"],
      onSelect: () => setPlayerActiveTab("pairings"),
    },
    {
      id: "call-judge",
      label: "Call judge",
      detail: selectedTable ? "Table is prefilled" : "Rules or logistics",
      href: "#judge",
      keywords: ["rules", "request"],
      tone: activeJudgeCall?.priority === "urgent" ? "danger" : "neutral",
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "help-desk",
      label: "Help desk",
      detail: "Water, lost item, accessibility, drop",
      href: "#help-desk",
      keywords: ["request", "lost", "water", "drop"],
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "card-lookup",
      label: "Commander lookup",
      detail: "Oracle and rulings",
      href: "#tools",
      keywords: ["card", "oracle", "rules"],
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "venue-map",
      label: "Venue map",
      detail: state.location ? "Floor map and parking" : "Floor map",
      href: "#floor-map",
      keywords: ["parking", "table", "map"],
      onSelect: () => setPlayerActiveTab("venue"),
    },
    ...(channelUrl
      ? [
          {
            id: "discord",
            label: "Discord",
            detail: "Open event channel",
            href: channelUrl,
            keywords: ["chat"],
          } satisfies RoleCommandAction,
        ]
      : []),
  ];
  const playerMobileActions: RoleCommandAction[] = [
    {
      id: "mobile-table",
      label: "My table",
      href: "#player",
      onSelect: () => setPlayerActiveTab("my-round"),
    },
    {
      id: "mobile-judge",
      label: "Judge",
      href: "#judge",
      tone: activeJudgeCall?.priority === "urgent" ? "danger" : "neutral",
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "mobile-help",
      label: "Help",
      href: "#help-desk",
      onSelect: () => setPlayerActiveTab("help"),
    },
    {
      id: "mobile-map",
      label: "Map",
      href: "#floor-map",
      onSelect: () => setPlayerActiveTab("venue"),
    },
  ];

  return (
    <div
      className={[
        "event-page",
        accessibilityView ? "accessibility-view" : "",
        `role-mode-${playerViewMode}`,
        `role-density-${playerDensity}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
            <button
              type="button"
              className="event-install-btn"
              onClick={() => setAccessibilityView((value) => !value)}
            >
              {accessibilityView ? "Standard" : "Accessibility"}
            </button>
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
        <EventAnnouncementBanner tid={tid} />

        <RoleExperienceShell
          role="Player"
          title={playerNextAction.label}
          subtitle={playerNextAction.detail}
          statusCards={playerStatusCards}
          tabs={playerTabs}
          activeTab={playerActiveTab}
          viewMode={playerViewMode}
          density={playerDensity}
          onTabChange={setPlayerActiveTab}
          onViewModeChange={setPlayerViewMode}
          onDensityChange={setPlayerDensity}
          actions={playerActions}
          alerts={playerAlerts}
          mobileActions={playerMobileActions}
        />

        <RoleWorkflowSection
          id="my-round"
          tabId="my-round"
          activeTab={playerActiveTab}
          viewMode={playerViewMode}
        >
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

          <div id="round-tools" className="event-tool-grid">
            <ResultSlipHelper
              selectedPlayer={selectedPlayer}
              selectedTable={selectedTable}
              localResult={localResult}
              onChange={setLocalResult}
            />
            <ReminderPanel state={state} />
          </div>
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="help-workflow"
          tabId="help"
          activeTab={playerActiveTab}
          viewMode={playerViewMode}
        >
          <div id="judge">
            <PlayerJudgeCallForm
              tid={tid}
              selectedPlayer={selectedPlayer}
              selectedTable={selectedTable}
            />
          </div>

          <PlayerHelpDeskForm
            tid={tid}
            selectedPlayer={selectedPlayer}
            selectedTable={selectedTable}
          />

          <div id="tools">
            <CommanderLookup tid={tid} commanderCandidates={commanderCandidates} />
          </div>
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="pairings-workflow"
          tabId="pairings"
          activeTab={playerActiveTab}
          viewMode={playerViewMode}
        >
          <section id="pairings-list" className="event-panel">
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
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="venue-workflow"
          tabId="venue"
          activeTab={playerActiveTab}
          viewMode={playerViewMode}
        >
          <PublicFloorMap tid={tid} selectedTable={selectedTable} />

          {state.location && (
            <section id="parking" className="event-parking-wrap">
              <ParkingSection tid={tid} location={state.location} />
            </section>
          )}
        </RoleWorkflowSection>
      </main>
    </div>
  );
}

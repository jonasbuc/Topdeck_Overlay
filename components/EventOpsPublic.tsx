"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TopDeckTable } from "@/lib/topdeck/types";
import type {
  FloorMapZone,
  JudgeCallCategory,
  JudgeCallDTO,
  PlayerRequestDTO,
  PlayerRequestType,
  TournamentAnnouncementDTO,
  TournamentFloorMapDTO,
} from "@/lib/event-ops/types";
import { JUDGE_CALL_CATEGORIES, PLAYER_REQUEST_TYPES } from "@/lib/event-ops/types";

interface AnnouncementResponse {
  announcements: TournamentAnnouncementDTO[];
}

interface FloorMapResponse {
  floorMap: TournamentFloorMapDTO;
}

interface JudgeCallResponse {
  call: JudgeCallDTO;
}

interface PlayerRequestResponse {
  request: PlayerRequestDTO;
}

const CATEGORY_LABELS: Record<JudgeCallCategory, string> = {
  rules: "Rules question",
  deck_check: "Deck check",
  missing_player: "Missing player",
  result_issue: "Result issue",
  logistics: "Logistics",
  other: "Other",
};

const REQUEST_LABELS: Record<PlayerRequestType, string> = {
  lost_item: "Lost item",
  water: "Need water",
  accessibility: "Accessibility help",
  drop: "Drop from event",
  help: "TO help",
};

export interface EventSelectedPlayer {
  id: string;
  name: string;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tableNumber(table: TopDeckTable | null): string {
  if (!table || table.table === "Byes") return "";
  return String(table.table);
}

function zoneMatchesTable(zone: FloorMapZone, table: TopDeckTable | null): boolean {
  if (!table || typeof table.table !== "number") return false;
  return table.table >= zone.tableStart && table.table <= zone.tableEnd;
}

export function EventAnnouncementBanner({ tid }: { tid: string }) {
  const [announcements, setAnnouncements] = useState<TournamentAnnouncementDTO[]>([]);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/announcements?audience=players`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AnnouncementResponse | null) =>
        setAnnouncements(data?.announcements ?? [])
      )
      .catch(() => setAnnouncements([]));
  }, [tid]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  if (announcements.length === 0) return null;

  const announcement = announcements[0];

  return (
    <section className={`event-announcement-banner ${announcement.tone}`}>
      <div>
        <span>{formatTime(announcement.createdAt)} announcement</span>
        <strong>{announcement.title}</strong>
        <p>{announcement.body}</p>
      </div>
    </section>
  );
}

export function PlayerJudgeCallForm({
  tid,
  selectedPlayer,
  selectedTable,
}: {
  tid: string;
  selectedPlayer: EventSelectedPlayer | null;
  selectedTable: TopDeckTable | null;
}) {
  const [playerName, setPlayerName] = useState("");
  const [table, setTable] = useState("");
  const [category, setCategory] = useState<JudgeCallCategory>("rules");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPlayerName(selectedPlayer?.name ?? "");
  }, [selectedPlayer?.name]);

  useEffect(() => {
    setTable(tableNumber(selectedTable));
  }, [selectedTable]);

  const submit = async () => {
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/judge-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: table,
          playerName,
          category,
          message,
        }),
      });
      if (!res.ok) throw new Error("call_failed");
      const payload = (await res.json()) as JudgeCallResponse;
      setStatus(
        `Request sent${payload.call.tableNumber ? ` for table ${payload.call.tableNumber}` : ""}.`
      );
      setMessage("");
    } catch {
      setStatus("Could not send judge request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="event-panel event-judge-panel">
      <div className="event-panel-header">
        <h2>Call Judge</h2>
      </div>
      <div className="event-judge-grid">
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Your name"
        />
        <input
          value={table}
          onChange={(event) => setTable(event.target.value)}
          placeholder="Table"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as JudgeCallCategory)}
        >
          {JUDGE_CALL_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {CATEGORY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Short note, e.g. rules question, deck check, missing player"
        rows={3}
      />
      <div className="event-judge-actions">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || (!playerName.trim() && !table.trim() && !message.trim())}
        >
          {submitting ? "Sending..." : "Send request"}
        </button>
        {status && <span>{status}</span>}
      </div>
    </section>
  );
}

export function PlayerHelpDeskForm({
  tid,
  selectedPlayer,
  selectedTable,
}: {
  tid: string;
  selectedPlayer: EventSelectedPlayer | null;
  selectedTable: TopDeckTable | null;
}) {
  const [playerName, setPlayerName] = useState("");
  const [table, setTable] = useState("");
  const [type, setType] = useState<PlayerRequestType>("help");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPlayerName(selectedPlayer?.name ?? "");
  }, [selectedPlayer?.name]);

  useEffect(() => {
    setTable(tableNumber(selectedTable));
  }, [selectedTable]);

  const submit = async () => {
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/player-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          tableNumber: table,
          playerName,
          message,
          priority: type === "accessibility" ? "high" : "normal",
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      const payload = (await res.json()) as PlayerRequestResponse;
      setStatus(
        `${REQUEST_LABELS[payload.request.type]} sent${
          payload.request.tableNumber
            ? ` for table ${payload.request.tableNumber}`
            : ""
        }.`
      );
      setMessage("");
    } catch {
      setStatus("Could not send help request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="help-desk" className="event-panel event-help-panel">
      <div className="event-panel-header">
        <h2>Help Desk</h2>
      </div>
      <div className="event-judge-grid">
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Your name"
        />
        <input
          value={table}
          onChange={(event) => setTable(event.target.value)}
          placeholder="Table"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value as PlayerRequestType)}
        >
          {PLAYER_REQUEST_TYPES.map((option) => (
            <option key={option} value={option}>
              {REQUEST_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Short note, e.g. black hoodie by table 8, need water, accessibility support"
        rows={3}
      />
      <div className="event-judge-actions">
        <button
          type="button"
          onClick={submit}
          disabled={
            submitting || (!playerName.trim() && !table.trim() && !message.trim())
          }
        >
          {submitting ? "Sending..." : "Send help request"}
        </button>
        {status && <span>{status}</span>}
      </div>
    </section>
  );
}

export function PublicFloorMap({
  tid,
  selectedTable,
}: {
  tid: string;
  selectedTable: TopDeckTable | null;
}) {
  const [floorMap, setFloorMap] = useState<TournamentFloorMapDTO | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tid}/floor-map`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FloorMapResponse | null) => setFloorMap(data?.floorMap ?? null))
      .catch(() => setFloorMap(null));
  }, [tid]);

  const zones = useMemo(
    () => (floorMap?.zones ?? []).slice().sort((a, b) => a.tableStart - b.tableStart),
    [floorMap?.zones]
  );

  if (!floorMap || zones.length === 0) return null;

  const selectedZone = zones.find((zone) => zoneMatchesTable(zone, selectedTable));

  return (
    <section id="floor-map" className="event-panel event-floor-map-panel">
      <div className="event-panel-header">
        <h2>{floorMap.title}</h2>
        {selectedZone && <span className="event-count-pill">{selectedZone.label}</span>}
      </div>
      {selectedTable && typeof selectedTable.table === "number" && (
        <div className="event-find-table-card">
          <span>Your table</span>
          <strong>Table {selectedTable.table}</strong>
          {selectedZone ? (
            <p>
              Go to {selectedZone.label}
              {selectedZone.detail ? ` · ${selectedZone.detail}` : ""}.
            </p>
          ) : (
            <p>This table is not mapped yet. Ask a TO near the scorekeeper station.</p>
          )}
        </div>
      )}
      {floorMap.notes && <p className="event-muted-line">{floorMap.notes}</p>}
      <div className="event-floor-zone-grid">
        {zones.map((zone) => (
          <article
            key={zone.id}
            className={`event-floor-zone ${
              zoneMatchesTable(zone, selectedTable) ? "selected" : ""
            }`}
          >
            <span>Tables {zone.tableStart}-{zone.tableEnd}</span>
            <strong>{zone.label}</strong>
            {zone.detail && <p>{zone.detail}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

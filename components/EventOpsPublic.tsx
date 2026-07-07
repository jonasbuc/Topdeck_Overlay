"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TopDeckTable } from "@/lib/topdeck/types";
import type {
  FloorMapZone,
  JudgeCallDTO,
  TournamentAnnouncementDTO,
  TournamentFloorMapDTO,
} from "@/lib/event-ops/types";

interface AnnouncementResponse {
  announcements: TournamentAnnouncementDTO[];
}

interface FloorMapResponse {
  floorMap: TournamentFloorMapDTO;
}

interface JudgeCallResponse {
  call: JudgeCallDTO;
}

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

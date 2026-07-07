"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnnouncementAudience,
  AnnouncementTone,
  FloorMapZone,
  JudgeCallDTO,
  TournamentAnnouncementDTO,
  TournamentFloorMapDTO,
} from "@/lib/event-ops/types";

interface Props {
  tid: string;
}

interface AnnouncementResponse {
  announcements: TournamentAnnouncementDTO[];
  discordPublished?: boolean;
}

interface JudgeCallsResponse {
  calls: JudgeCallDTO[];
}

interface FloorMapResponse {
  floorMap: TournamentFloorMapDTO;
}

const TONES: AnnouncementTone[] = ["info", "success", "warning", "urgent"];
const AUDIENCES: AnnouncementAudience[] = ["all", "players", "venue", "discord"];

function formatTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function newZone(index: number): FloorMapZone {
  const start = index * 8 + 1;
  return {
    id: `zone-${Date.now()}-${index}`,
    label: `Area ${index + 1}`,
    tableStart: start,
    tableEnd: start + 7,
    detail: "",
  };
}

export function EventOperationsPanel({ tid }: Props) {
  return (
    <div className="event-ops-suite">
      <AnnouncementComposer tid={tid} />
      <ShareQrPanel tid={tid} />
      <JudgeQueuePanel tid={tid} />
      <FloorMapEditor tid={tid} />
    </div>
  );
}

function AnnouncementComposer({ tid }: Props) {
  const [announcements, setAnnouncements] = useState<TournamentAnnouncementDTO[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<AnnouncementTone>("info");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [publishToDiscord, setPublishToDiscord] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/announcements?all=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AnnouncementResponse | null) =>
        setAnnouncements(data?.announcements ?? [])
      )
      .catch(() => setAnnouncements([]));
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          tone,
          audience,
          pinned: true,
          publishToDiscord,
        }),
      });
      const payload = (await res.json()) as AnnouncementResponse | { error: string };
      if (!res.ok) throw new Error("save_failed");
      setTitle("");
      setBody("");
      setPublishToDiscord(false);
      setMessage(
        "discordPublished" in payload && payload.discordPublished
          ? "Announcement posted and sent to Discord."
          : "Announcement posted."
      );
      load();
    } catch {
      setMessage("Could not post announcement.");
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (announcement: TournamentAnnouncementDTO) => {
    await fetch(`/api/tournaments/${tid}/announcements`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: announcement.id, pinned: !announcement.pinned }),
    });
    load();
  };

  const remove = async (announcement: TournamentAnnouncementDTO) => {
    await fetch(`/api/tournaments/${tid}/announcements`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: announcement.id }),
    });
    load();
  };

  return (
    <section className="card event-ops-card announcement-composer">
      <div className="event-ops-card-header">
        <div>
          <h2>Announcements</h2>
          <p>Post to player page, venue display and optionally Discord.</p>
        </div>
      </div>

      <div className="event-ops-form-grid">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          maxLength={80}
        />
        <select
          value={tone}
          onChange={(event) => setTone(event.target.value as AnnouncementTone)}
        >
          {TONES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={audience}
          onChange={(event) =>
            setAudience(event.target.value as AnnouncementAudience)
          }
        >
          {AUDIENCES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Message"
        maxLength={1000}
        rows={4}
      />

      <div className="event-ops-action-row">
        <label className="event-ops-check">
          <input
            type="checkbox"
            checked={publishToDiscord}
            onChange={(event) => setPublishToDiscord(event.target.checked)}
          />
          <span>Also send to Discord</span>
        </label>
        <button
          type="button"
          className="event-ops-primary-btn"
          onClick={submit}
          disabled={saving || !title.trim() || !body.trim()}
        >
          {saving ? "Posting..." : "Post announcement"}
        </button>
      </div>

      {message && <div className="event-ops-message">{message}</div>}

      <div className="event-ops-list">
        {announcements.slice(0, 6).map((announcement) => (
          <article
            key={announcement.id}
            className={`event-ops-announcement-row ${announcement.tone}`}
          >
            <div>
              <span>
                {announcement.audience} · {formatTime(announcement.createdAt)}
              </span>
              <strong>{announcement.title}</strong>
              <p>{announcement.body}</p>
            </div>
            <div className="event-ops-row-actions">
              <button type="button" onClick={() => togglePinned(announcement)}>
                {announcement.pinned ? "Archive" : "Pin"}
              </button>
              <button type="button" onClick={() => remove(announcement)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShareQrPanel({ tid }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin || "http://localhost:3000"}/event/${tid}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&data=${encodeURIComponent(url)}`;

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  };

  const share = () => {
    if (!navigator.share) {
      copy();
      return;
    }
    navigator.share({ title: "TopDeck Live event page", url }).catch(() => {});
  };

  return (
    <section className="card event-ops-card share-qr-card">
      <div className="event-ops-card-header">
        <div>
          <h2>QR / Share</h2>
          <p>Put this on a projector, Discord post or printed sign.</p>
        </div>
      </div>

      <div className="share-qr-layout">
        <img src={qrUrl} alt="QR code for player page" />
        <div>
          <code>{url}</code>
          <div className="event-ops-action-row">
            <button type="button" className="event-ops-primary-btn" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className="event-ops-secondary-btn" onClick={share}>
              Share
            </button>
          </div>
          <p className="event-ops-small-note">
            The QR image is generated from the public event URL; the copy/share
            buttons work even if the QR provider is blocked.
          </p>
        </div>
      </div>
    </section>
  );
}

function JudgeQueuePanel({ tid }: Props) {
  const [calls, setCalls] = useState<JudgeCallDTO[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/judge-calls${includeResolved ? "?all=true" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: JudgeCallsResponse | null) => setCalls(data?.calls ?? []))
      .catch(() => setCalls([]));
  }, [includeResolved, tid]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 6000);
    return () => window.clearInterval(id);
  }, [load]);

  const setStatus = async (call: JudgeCallDTO, status: JudgeCallDTO["status"]) => {
    await fetch(`/api/tournaments/${tid}/judge-calls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: call.id, status }),
    });
    load();
  };

  const openCount = calls.filter((call) => call.status === "open").length;

  return (
    <section className="card event-ops-card judge-queue-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Judge Queue</h2>
          <p>{openCount} open request{openCount === 1 ? "" : "s"}</p>
        </div>
        <label className="event-ops-check">
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(event) => setIncludeResolved(event.target.checked)}
          />
          <span>Show resolved</span>
        </label>
      </div>

      <div className="event-ops-list">
        {calls.length === 0 && (
          <p className="empty-state">No judge calls right now.</p>
        )}
        {calls.map((call) => (
          <article key={call.id} className={`judge-call-row ${call.status}`}>
            <div>
              <span>
                {call.tableNumber ? `Table ${call.tableNumber}` : "No table"} ·
                {" "}{formatTime(call.createdAt)}
              </span>
              <strong>{call.playerName || "Player"}</strong>
              {call.message && <p>{call.message}</p>}
            </div>
            <div className="event-ops-row-actions">
              {call.status === "open" && (
                <button type="button" onClick={() => setStatus(call, "acknowledged")}>
                  Ack
                </button>
              )}
              {call.status !== "resolved" && (
                <button type="button" onClick={() => setStatus(call, "resolved")}>
                  Resolve
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FloorMapEditor({ tid }: Props) {
  const [title, setTitle] = useState("Venue floor map");
  const [notes, setNotes] = useState("");
  const [zones, setZones] = useState<FloorMapZone[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/floor-map`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FloorMapResponse | null) => {
        if (!data?.floorMap) return;
        setTitle(data.floorMap.title);
        setNotes(data.floorMap.notes ?? "");
        setZones(data.floorMap.zones);
      })
      .catch(() => {});
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const updateZone = <K extends keyof FloorMapZone>(
    index: number,
    key: K,
    value: FloorMapZone[K]
  ) => {
    setZones((current) =>
      current.map((zone, i) => (i === index ? { ...zone, [key]: value } : zone))
    );
  };

  const save = async () => {
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/floor-map`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notes, zones }),
      });
      if (!res.ok) throw new Error("save_failed");
      const data = (await res.json()) as FloorMapResponse;
      setZones(data.floorMap.zones);
      setMessage("Floor map saved.");
    } catch {
      setMessage("Could not save floor map.");
    }
  };

  const preview = useMemo(
    () => zones.slice().sort((a, b) => a.tableStart - b.tableStart),
    [zones]
  );

  return (
    <section className="card event-ops-card floor-map-editor">
      <div className="event-ops-card-header">
        <div>
          <h2>Table / Floor Map</h2>
          <p>Map table ranges to areas players can actually find.</p>
        </div>
        <button
          type="button"
          className="event-ops-secondary-btn"
          onClick={() => setZones((current) => [...current, newZone(current.length)])}
        >
          Add zone
        </button>
      </div>

      <div className="event-ops-form-grid floor-map-title-grid">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Map title"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes, e.g. Stage left, upstairs, near bar"
        />
      </div>

      <div className="floor-map-zone-list">
        {zones.map((zone, index) => (
          <div key={zone.id} className="floor-map-zone-editor">
            <input
              value={zone.label}
              onChange={(event) => updateZone(index, "label", event.target.value)}
              placeholder="Area label"
            />
            <input
              type="number"
              min={1}
              value={zone.tableStart}
              onChange={(event) =>
                updateZone(index, "tableStart", Number(event.target.value))
              }
            />
            <input
              type="number"
              min={1}
              value={zone.tableEnd}
              onChange={(event) =>
                updateZone(index, "tableEnd", Number(event.target.value))
              }
            />
            <input
              value={zone.detail ?? ""}
              onChange={(event) => updateZone(index, "detail", event.target.value)}
              placeholder="Detail"
            />
            <button
              type="button"
              onClick={() =>
                setZones((current) => current.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="floor-map-preview">
        {preview.length === 0 ? (
          <p className="empty-state">No zones yet.</p>
        ) : (
          preview.map((zone) => (
            <span key={zone.id}>
              Tables {zone.tableStart}-{zone.tableEnd}: {zone.label}
            </span>
          ))
        )}
      </div>

      <div className="event-ops-action-row">
        <button type="button" className="event-ops-primary-btn" onClick={save}>
          Save floor map
        </button>
        {message && <span className="event-ops-message">{message}</span>}
      </div>
    </section>
  );
}

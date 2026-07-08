"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  BroadcastRunbookItemDTO,
  BroadcastRunbookStatus,
  BroadcastSegment,
  ClipMarkerDTO,
  IncidentCategory,
  IncidentLogDTO,
  IncidentSeverity,
  IncidentStatus,
  PlayerRequestDTO,
  PlayerRequestType,
  StaffAssignmentDTO,
  StaffAssignmentStatus,
  StaffRole,
} from "@/lib/event-ops/types";
import {
  BROADCAST_RUNBOOK_STATUSES,
  BROADCAST_SEGMENTS,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  PLAYER_REQUEST_TYPES,
  STAFF_ASSIGNMENT_STATUSES,
  STAFF_ROLES,
} from "@/lib/event-ops/types";

interface Props {
  tid: string;
}

interface PlayerRequestsResponse {
  requests: PlayerRequestDTO[];
}

interface StaffAssignmentsResponse {
  assignments: StaffAssignmentDTO[];
}

interface IncidentsResponse {
  incidents: IncidentLogDTO[];
}

interface BroadcastResponse {
  runbook: BroadcastRunbookItemDTO[];
  clips: ClipMarkerDTO[];
}

const REQUEST_LABELS: Record<PlayerRequestType, string> = {
  lost_item: "Lost item",
  water: "Water",
  accessibility: "Accessibility",
  drop: "Drop",
  help: "TO help",
};

const STAFF_LABELS: Record<StaffRole, string> = {
  head_judge: "Head judge",
  floor_judge: "Floor judge",
  scorekeeper: "Scorekeeper",
  coverage: "Coverage",
  runner: "Runner",
  TO: "TO",
};

const INCIDENT_LABELS: Record<IncidentCategory, string> = {
  penalty: "Penalty",
  appeal: "Appeal",
  slow_play: "Slow play",
  deck_issue: "Deck issue",
  conduct: "Conduct",
  other: "Other",
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  note: "Note",
  warning: "Warning",
  game_loss: "Game loss",
  match_loss: "Match loss",
  disqualification: "Disqualification",
};

const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  pre_round: "Pre-round",
  round: "Round",
  break: "Break",
  top_cut: "Top cut",
  finals: "Finals",
  sponsor: "Sponsor",
  custom: "Custom",
};

function formatTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageLabel(value: string): string {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "-";
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60_000));
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function EventOpsAdvancedSuite({ tid }: Props) {
  return (
    <div className="event-ops-advanced-suite">
      <PlayerRequestsPanel tid={tid} />
      <StaffRolesPanel tid={tid} />
      <IncidentLogPanel tid={tid} />
      <BroadcastRunbookPanel tid={tid} />
      <EmergencyToolsPanel tid={tid} />
    </div>
  );
}

export function PlayerRequestsPanel({ tid }: Props) {
  const [requests, setRequests] = useState<PlayerRequestDTO[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/player-requests${includeResolved ? "?all=true" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlayerRequestsResponse | null) => setRequests(data?.requests ?? []))
      .catch(() => setRequests([]));
  }, [includeResolved, tid]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 7000);
    return () => window.clearInterval(id);
  }, [load]);

  const patch = async (
    request: PlayerRequestDTO,
    body: Partial<Pick<PlayerRequestDTO, "status" | "assignedTo" | "internalNote">>
  ) => {
    await fetch(`/api/tournaments/${tid}/player-requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: request.id, ...body }),
    });
    load();
  };

  const openCount = requests.filter((item) => item.status === "open").length;
  const urgentCount = requests.filter(
    (item) => item.status !== "resolved" && item.priority === "urgent"
  ).length;

  return (
    <section className="card event-ops-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Help Desk Queue</h2>
          <p>{openCount} open · {urgentCount} urgent · {requests.length} visible</p>
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
        {requests.length === 0 && <p className="empty-state">No player requests.</p>}
        {requests.map((request) => (
          <article
            key={request.id}
            className={`event-tool-row status-${request.status} priority-${request.priority}`}
          >
            <div>
              <span>
                {REQUEST_LABELS[request.type]} · {formatTime(request.createdAt)} ·{" "}
                {ageLabel(request.createdAt)}
              </span>
              <strong>
                {request.playerName || "Player"}
                {request.tableNumber ? ` · Table ${request.tableNumber}` : ""}
              </strong>
              {request.message && <p>{request.message}</p>}
              {request.internalNote && (
                <p className="judge-internal-note">{request.internalNote}</p>
              )}
              <div className="judge-control-grid">
                <label>
                  <span>Assigned</span>
                  <input
                    defaultValue={request.assignedTo ?? ""}
                    placeholder="Staff name"
                    onBlur={(event) =>
                      patch(request, { assignedTo: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Internal note</span>
                  <input
                    defaultValue={request.internalNote ?? ""}
                    placeholder="Private note"
                    onBlur={(event) =>
                      patch(request, { internalNote: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="event-ops-row-actions">
              {request.status === "open" && (
                <button type="button" onClick={() => patch(request, { status: "acknowledged" })}>
                  Ack
                </button>
              )}
              {request.status !== "resolved" && (
                <button type="button" onClick={() => patch(request, { status: "resolved" })}>
                  Resolve
                </button>
              )}
              {request.status === "resolved" && (
                <button type="button" onClick={() => patch(request, { status: "open" })}>
                  Reopen
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StaffRolesPanel({ tid }: Props) {
  const [assignments, setAssignments] = useState<StaffAssignmentDTO[]>([]);
  const [staffName, setStaffName] = useState("");
  const [role, setRole] = useState<StaffRole>("floor_judge");
  const [zone, setZone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/staff-roles`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StaffAssignmentsResponse | null) =>
        setAssignments(data?.assignments ?? [])
      )
      .catch(() => setAssignments([]));
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!staffName.trim()) return;
    await fetch(`/api/tournaments/${tid}/staff-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffName, role, zone, tableNumber, note }),
    });
    setStaffName("");
    setZone("");
    setTableNumber("");
    setNote("");
    load();
  };

  const patch = async (
    assignment: StaffAssignmentDTO,
    body: Partial<Pick<StaffAssignmentDTO, "status" | "role" | "zone" | "note">>
  ) => {
    await fetch(`/api/tournaments/${tid}/staff-roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignment.id, ...body }),
    });
    load();
  };

  const active = assignments.filter((item) => item.status === "active").length;

  return (
    <section className="card event-ops-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Staff Roles</h2>
          <p>{active} active · {assignments.length} assigned</p>
        </div>
      </div>
      <div className="event-ops-form-grid staff-role-grid">
        <input
          value={staffName}
          onChange={(event) => setStaffName(event.target.value)}
          placeholder="Staff name"
        />
        <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
          {STAFF_ROLES.map((option) => (
            <option key={option} value={option}>
              {STAFF_LABELS[option]}
            </option>
          ))}
        </select>
        <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Zone" />
        <input
          value={tableNumber}
          onChange={(event) => setTableNumber(event.target.value)}
          placeholder="Table"
        />
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" />
        <button type="button" className="event-ops-primary-btn" onClick={add}>
          Assign
        </button>
      </div>
      <div className="event-ops-list staff-assignment-list">
        {assignments.length === 0 && <p className="empty-state">No staff assigned yet.</p>}
        {assignments.map((assignment) => (
          <article key={assignment.id} className={`staff-role-row ${assignment.status}`}>
            <div>
              <span>{STAFF_LABELS[assignment.role]}</span>
              <strong>{assignment.staffName}</strong>
              <p>
                {assignment.zone || "No zone"}
                {assignment.tableNumber ? ` · Table ${assignment.tableNumber}` : ""}
                {assignment.note ? ` · ${assignment.note}` : ""}
              </p>
            </div>
            <div className="event-ops-row-actions">
              <select
                value={assignment.status}
                onChange={(event) =>
                  patch(assignment, {
                    status: event.target.value as StaffAssignmentStatus,
                  })
                }
              >
                {STAFF_ASSIGNMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function IncidentLogPanel({ tid }: Props) {
  const [incidents, setIncidents] = useState<IncidentLogDTO[]>([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("note");
  const [summary, setSummary] = useState("");
  const [ruling, setRuling] = useState("");
  const [appealed, setAppealed] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/incidents${includeClosed ? "?all=true" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: IncidentsResponse | null) => setIncidents(data?.incidents ?? []))
      .catch(() => setIncidents([]));
  }, [includeClosed, tid]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!summary.trim()) return;
    await fetch(`/api/tournaments/${tid}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName,
        tableNumber,
        category,
        severity,
        summary,
        ruling,
        appealed,
      }),
    });
    setPlayerName("");
    setTableNumber("");
    setSummary("");
    setRuling("");
    setAppealed(false);
    load();
  };

  const patchStatus = async (incident: IncidentLogDTO, status: IncidentStatus) => {
    await fetch(`/api/tournaments/${tid}/incidents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: incident.id, status }),
    });
    load();
  };

  return (
    <section className="card event-ops-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Incident Log</h2>
          <p>{incidents.length} visible private records</p>
        </div>
        <label className="event-ops-check">
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(event) => setIncludeClosed(event.target.checked)}
          />
          <span>Show closed</span>
        </label>
      </div>
      <div className="event-ops-form-grid incident-form-grid">
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Player"
        />
        <input
          value={tableNumber}
          onChange={(event) => setTableNumber(event.target.value)}
          placeholder="Table"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as IncidentCategory)}
        >
          {INCIDENT_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {INCIDENT_LABELS[option]}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
        >
          {INCIDENT_SEVERITIES.map((option) => (
            <option key={option} value={option}>
              {SEVERITY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Summary"
        rows={3}
      />
      <textarea
        value={ruling}
        onChange={(event) => setRuling(event.target.value)}
        placeholder="Ruling / follow-up"
        rows={2}
      />
      <div className="event-ops-action-row">
        <label className="event-ops-check">
          <input
            type="checkbox"
            checked={appealed}
            onChange={(event) => setAppealed(event.target.checked)}
          />
          <span>Appeal involved</span>
        </label>
        <button
          type="button"
          className="event-ops-primary-btn"
          onClick={add}
          disabled={!summary.trim()}
        >
          Add incident
        </button>
      </div>
      <div className="event-ops-list">
        {incidents.length === 0 && <p className="empty-state">No incidents logged.</p>}
        {incidents.map((incident) => (
          <article key={incident.id} className={`incident-row ${incident.severity}`}>
            <div>
              <span>
                {INCIDENT_LABELS[incident.category]} · {SEVERITY_LABELS[incident.severity]} ·{" "}
                {formatTime(incident.createdAt)}
              </span>
              <strong>
                {incident.playerName || "Event note"}
                {incident.tableNumber ? ` · Table ${incident.tableNumber}` : ""}
              </strong>
              <p>{incident.summary}</p>
              {incident.ruling && <p className="judge-internal-note">{incident.ruling}</p>}
            </div>
            <div className="event-ops-row-actions">
              {INCIDENT_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={incident.status === status ? "active" : ""}
                  onClick={() => patchStatus(incident, status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BroadcastRunbookPanel({ tid }: Props) {
  const [runbook, setRunbook] = useState<BroadcastRunbookItemDTO[]>([]);
  const [clips, setClips] = useState<ClipMarkerDTO[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<BroadcastSegment>("round");
  const [featureTable, setFeatureTable] = useState("");
  const [lowerThird, setLowerThird] = useState("");
  const [sponsorLine, setSponsorLine] = useState("");
  const [clipLabel, setClipLabel] = useState("Key moment");

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/broadcast`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BroadcastResponse | null) => {
        setRunbook(data?.runbook ?? []);
        setClips(data?.clips ?? []);
      })
      .catch(() => {
        setRunbook([]);
        setClips([]);
      });
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const liveItem = useMemo(
    () => runbook.find((item) => item.status === "live") ?? null,
    [runbook]
  );

  const addItem = async () => {
    if (!title.trim()) return;
    await fetch(`/api/tournaments/${tid}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        segment,
        featureTable,
        lowerThird,
        sponsorLine,
        sortOrder: runbook.length + 1,
      }),
    });
    setTitle("");
    setBody("");
    setFeatureTable("");
    setLowerThird("");
    setSponsorLine("");
    load();
  };

  const patchItem = async (
    item: BroadcastRunbookItemDTO,
    status: BroadcastRunbookStatus
  ) => {
    await fetch(`/api/tournaments/${tid}/broadcast`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status }),
    });
    load();
  };

  const addClip = async () => {
    if (!clipLabel.trim()) return;
    await fetch(`/api/tournaments/${tid}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "clip",
        label: clipLabel,
        tableNumber: featureTable,
        note: liveItem?.title ?? "",
      }),
    });
    load();
  };

  return (
    <section className="card event-ops-card broadcast-runbook-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Broadcast Runbook</h2>
          <p>
            {liveItem ? `Live: ${liveItem.title}` : "No live segment"} · {clips.length} clips
          </p>
        </div>
      </div>
      <div className="event-ops-form-grid broadcast-form-grid">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Cue title" />
        <select
          value={segment}
          onChange={(event) => setSegment(event.target.value as BroadcastSegment)}
        >
          {BROADCAST_SEGMENTS.map((option) => (
            <option key={option} value={option}>
              {SEGMENT_LABELS[option]}
            </option>
          ))}
        </select>
        <input
          value={featureTable}
          onChange={(event) => setFeatureTable(event.target.value)}
          placeholder="Feature table"
        />
        <input
          value={lowerThird}
          onChange={(event) => setLowerThird(event.target.value)}
          placeholder="Lower third"
        />
        <input
          value={sponsorLine}
          onChange={(event) => setSponsorLine(event.target.value)}
          placeholder="Sponsor line"
        />
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Talking points" rows={3} />
      <div className="event-ops-action-row">
        <button
          type="button"
          className="event-ops-primary-btn"
          onClick={addItem}
          disabled={!title.trim()}
        >
          Add cue
        </button>
        <input
          value={clipLabel}
          onChange={(event) => setClipLabel(event.target.value)}
          placeholder="Clip label"
        />
        <button type="button" className="event-ops-secondary-btn" onClick={addClip}>
          Mark clip
        </button>
      </div>
      <div className="event-ops-list">
        {runbook.length === 0 && <p className="empty-state">No broadcast cues yet.</p>}
        {runbook.map((item) => (
          <article key={item.id} className={`broadcast-cue-row ${item.status}`}>
            <div>
              <span>
                {SEGMENT_LABELS[item.segment]} · {item.featureTable ? `Table ${item.featureTable}` : "No feature"}
              </span>
              <strong>{item.title}</strong>
              {item.body && <p>{item.body}</p>}
              {(item.lowerThird || item.sponsorLine) && (
                <p className="judge-internal-note">
                  {item.lowerThird || "No lower third"}
                  {item.sponsorLine ? ` · ${item.sponsorLine}` : ""}
                </p>
              )}
            </div>
            <div className="event-ops-row-actions">
              {BROADCAST_RUNBOOK_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={item.status === status ? "active" : ""}
                  onClick={() => patchItem(item, status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="clip-marker-list">
        {clips.slice(0, 6).map((clip) => (
          <span key={clip.id}>
            {formatTime(clip.createdAt)} · {clip.label}
            {clip.tableNumber ? ` · T${clip.tableNumber}` : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

export function EmergencyToolsPanel({ tid }: Props) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const publish = async () => {
    if (!message.trim()) return;
    setStatus("Publishing...");
    try {
      const res = await fetch(`/api/tournaments/${tid}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Urgent event announcement",
          body: message,
          tone: "urgent",
          audience: "all",
          pinned: true,
          publishToDiscord: true,
        }),
      });
      if (!res.ok) throw new Error("publish_failed");
      setMessage("");
      setStatus("Emergency announcement posted.");
    } catch {
      setStatus("Could not post emergency announcement.");
    }
  };

  return (
    <section className="card event-ops-card emergency-tools-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Emergency Tools</h2>
          <p>Post one urgent banner to player page, venue display and Discord.</p>
        </div>
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Urgent message"
        rows={3}
      />
      <div className="event-ops-action-row">
        <button
          type="button"
          className="event-ops-primary-btn danger"
          onClick={publish}
          disabled={!message.trim()}
        >
          Publish emergency banner
        </button>
        <Link href={`/venue/${tid}`} target="_blank" className="event-ops-secondary-link">
          Venue screen
        </Link>
        <Link href={`/event/${tid}`} target="_blank" className="event-ops-secondary-link">
          Player page
        </Link>
      </div>
      {status && <p className="event-ops-message">{status}</p>}
    </section>
  );
}

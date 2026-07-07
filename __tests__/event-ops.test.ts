import { describe, expect, it } from "vitest";

import {
  serializeAnnouncement,
  serializeBroadcastRunbookItem,
  serializeClipMarker,
  serializeFloorMap,
  serializeIncidentLog,
  serializeJudgeCall,
  serializePlayerRequest,
  serializeStaffAssignment,
} from "@/lib/event-ops/serializers";
import {
  normalizeBroadcastRunbookStatus,
  normalizeFloorMapZones,
  normalizeIncidentSeverity,
  normalizePlayerRequestType,
} from "@/lib/event-ops/types";

const now = new Date("2026-07-07T00:00:00.000Z");

describe("event operations serializers", () => {
  it("normalizes invalid announcement tone and audience values", () => {
    const dto = serializeAnnouncement({
      id: "announcement_1",
      tid: "tid_1",
      title: "Pairings posted",
      body: "Round 4 is live.",
      tone: "loud",
      audience: "staff-only",
      pinned: true,
      publishedToDiscordAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(dto.tone).toBe("info");
    expect(dto.audience).toBe("all");
    expect(dto.createdAt).toBe("2026-07-07T00:00:00.000Z");
  });

  it("normalizes invalid judge call status values", () => {
    const dto = serializeJudgeCall({
      id: "call_1",
      tid: "tid_1",
      tableNumber: "12",
      playerName: "Player One",
      message: "Need oracle text",
      status: "triaged",
      category: "mystery",
      priority: "panic",
      assignedTo: null,
      internalNote: null,
      createdAt: now,
      updatedAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
    });

    expect(dto.status).toBe("open");
    expect(dto.category).toBe("rules");
    expect(dto.priority).toBe("normal");
    expect(dto.resolvedAt).toBeNull();
  });

  it("returns a stable empty floor-map DTO when no map exists", () => {
    const dto = serializeFloorMap(null, "tid_1");

    expect(dto).toEqual({
      tid: "tid_1",
      title: "Venue floor map",
      zones: [],
      notes: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it("normalizes floor-map zones and drops unusable rows", () => {
    const zones = normalizeFloorMapZones([
      { id: "pod-a", label: " Stage side ", tableStart: 8.4, tableEnd: 1.2 },
      { label: "Bar side", tableStart: "9", tableEnd: "16", detail: " Near cafe " },
      { label: "", tableStart: 17, tableEnd: 20 },
      { label: "Broken", tableStart: "nope", tableEnd: 22 },
    ]);

    expect(zones).toEqual([
      { id: "pod-a", label: "Stage side", tableStart: 1, tableEnd: 8 },
      {
        id: "zone-2",
        label: "Bar side",
        tableStart: 9,
        tableEnd: 16,
        detail: "Near cafe",
      },
    ]);
  });

  it("serializes valid floor-map JSON into public DTO shape", () => {
    const dto = serializeFloorMap(
      {
        tid: "tid_1",
        title: "Main hall",
        zones: JSON.stringify([{ label: "Feature pods", tableStart: 1, tableEnd: 4 }]),
        notes: "Judge station by the entrance",
        createdAt: now,
        updatedAt: now,
      },
      "tid_1"
    );

    expect(dto.title).toBe("Main hall");
    expect(dto.zones).toHaveLength(1);
    expect(dto.zones[0].id).toBe("zone-1");
    expect(dto.notes).toBe("Judge station by the entrance");
  });

  it("normalizes new player request values", () => {
    const dto = serializePlayerRequest({
      id: "request_1",
      tid: "tid_1",
      type: "snacks",
      playerName: "Player One",
      tableNumber: "4",
      message: "Need water",
      status: "waiting",
      priority: "panic",
      assignedTo: null,
      internalNote: null,
      createdAt: now,
      updatedAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
    });

    expect(dto.type).toBe("help");
    expect(dto.status).toBe("open");
    expect(dto.priority).toBe("normal");
    expect(normalizePlayerRequestType("water")).toBe("water");
  });

  it("serializes staff assignments, incidents and broadcast cues", () => {
    const staff = serializeStaffAssignment({
      id: "staff_1",
      tid: "tid_1",
      staffName: "Judge A",
      role: "mystery",
      zone: "Blue",
      tableNumber: null,
      status: "lunch",
      note: null,
      createdAt: now,
      updatedAt: now,
    });
    const incident = serializeIncidentLog({
      id: "incident_1",
      tid: "tid_1",
      playerName: null,
      tableNumber: "8",
      category: "slow_play",
      severity: "major",
      summary: "Pace note",
      ruling: null,
      appealed: false,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    const cue = serializeBroadcastRunbookItem({
      id: "cue_1",
      tid: "tid_1",
      segment: "intro",
      title: "Feature match",
      body: null,
      status: "ready",
      featureTable: "1",
      lowerThird: null,
      sponsorLine: null,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const clip = serializeClipMarker({
      id: "clip_1",
      tid: "tid_1",
      label: "Final turn",
      note: null,
      roundLabel: "Round 4",
      tableNumber: "1",
      createdAt: now,
    });

    expect(staff.role).toBe("floor_judge");
    expect(staff.status).toBe("active");
    expect(incident.category).toBe("slow_play");
    expect(incident.severity).toBe("note");
    expect(cue.segment).toBe("round");
    expect(cue.status).toBe("queued");
    expect(clip.roundLabel).toBe("Round 4");
    expect(normalizeIncidentSeverity("warning")).toBe("warning");
    expect(normalizeBroadcastRunbookStatus("live")).toBe("live");
  });
});

import { describe, expect, it } from "vitest";

import {
  serializeAnnouncement,
  serializeFloorMap,
  serializeJudgeCall,
} from "@/lib/event-ops/serializers";
import { normalizeFloorMapZones } from "@/lib/event-ops/types";

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
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });

    expect(dto.status).toBe("open");
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
});

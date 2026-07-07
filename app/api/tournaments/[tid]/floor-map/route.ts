/**
 * Tournament floor map API.
 *
 * Stores lightweight table-range zones that are shown on the player page and
 * venue display. This is intentionally simple: organizers can describe where
 * table ranges live without needing a full graphical editor.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeFloorMap } from "@/lib/event-ops/serializers";
import { normalizeFloorMapZones } from "@/lib/event-ops/types";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const row = await prisma.tournamentFloorMap.findUnique({ where: { tid } });
  return NextResponse.json({ floorMap: serializeFloorMap(row, tid) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const title = cleanText(body.title, 80) || "Venue floor map";
  const notes = cleanText(body.notes, 500);
  const zones = normalizeFloorMapZones(body.zones);

  const row = await prisma.tournamentFloorMap.upsert({
    where: { tid },
    create: {
      tid,
      title,
      notes: notes || null,
      zones: JSON.stringify(zones),
    },
    update: {
      title,
      notes: notes || null,
      zones: JSON.stringify(zones),
    },
  });

  return NextResponse.json({ floorMap: serializeFloorMap(row, tid) });
}

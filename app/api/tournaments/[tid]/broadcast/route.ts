/**
 * Broadcast operations API.
 *
 * Shared runbook, lower-third notes and clip markers for producer and
 * commentator workflows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  serializeBroadcastRunbookItem,
  serializeClipMarker,
} from "@/lib/event-ops/serializers";
import {
  normalizeBroadcastRunbookStatus,
  normalizeBroadcastSegment,
} from "@/lib/event-ops/types";
import { getTournamentState } from "@/lib/topdeck/tournament-state";

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
  const [runbook, clips] = await Promise.all([
    prisma.broadcastRunbookItem.findMany({
      where: { tid },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 100,
    }),
    prisma.clipMarker.findMany({
      where: { tid },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    runbook: runbook.map(serializeBroadcastRunbookItem),
    clips: clips.map(serializeClipMarker),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const kind = cleanText(body.kind, 24);

  if (kind === "clip") {
    const label = cleanText(body.label, 120);
    const note = cleanText(body.note, 500);
    const tableNumber = cleanText(body.tableNumber, 24);
    const state = await getTournamentState(tid);
    const roundLabel =
      cleanText(body.roundLabel, 80) ||
      state?.roundLabel ||
      (state?.currentRound ? `Round ${state.currentRound}` : "");

    if (!label) {
      return NextResponse.json({ error: "label_required" }, { status: 400 });
    }

    const row = await prisma.clipMarker.create({
      data: {
        tid,
        label,
        note: note || null,
        roundLabel: roundLabel || null,
        tableNumber: tableNumber || null,
      },
    });

    return NextResponse.json({ clip: serializeClipMarker(row) }, { status: 201 });
  }

  const title = cleanText(body.title, 120);
  const bodyText = cleanText(body.body, 1000);
  const featureTable = cleanText(body.featureTable, 24);
  const lowerThird = cleanText(body.lowerThird, 180);
  const sponsorLine = cleanText(body.sponsorLine, 180);
  const segment = normalizeBroadcastSegment(body.segment);
  const status = normalizeBroadcastRunbookStatus(body.status);
  const sortOrder = Number(body.sortOrder);

  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const row = await prisma.broadcastRunbookItem.create({
    data: {
      tid,
      title,
      body: bodyText || null,
      segment,
      status,
      featureTable: featureTable || null,
      lowerThird: lowerThird || null,
      sponsorLine: sponsorLine || null,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    },
  });

  return NextResponse.json(
    { item: serializeBroadcastRunbookItem(row) },
    { status: 201 }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const id = cleanText(body.id, 128);

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const existing = await prisma.broadcastRunbookItem.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sortOrder = Number(body.sortOrder);
  const row = await prisma.broadcastRunbookItem.update({
    where: { id },
    data: {
      ...(typeof body.segment === "string"
        ? { segment: normalizeBroadcastSegment(body.segment) }
        : {}),
      ...(typeof body.title === "string"
        ? { title: cleanText(body.title, 120) || existing.title }
        : {}),
      ...(typeof body.body === "string"
        ? { body: cleanText(body.body, 1000) || null }
        : {}),
      ...(typeof body.status === "string"
        ? { status: normalizeBroadcastRunbookStatus(body.status) }
        : {}),
      ...(typeof body.featureTable === "string"
        ? { featureTable: cleanText(body.featureTable, 24) || null }
        : {}),
      ...(typeof body.lowerThird === "string"
        ? { lowerThird: cleanText(body.lowerThird, 180) || null }
        : {}),
      ...(typeof body.sponsorLine === "string"
        ? { sponsorLine: cleanText(body.sponsorLine, 180) || null }
        : {}),
      ...(Number.isFinite(sortOrder) ? { sortOrder: Math.round(sortOrder) } : {}),
    },
  });

  return NextResponse.json({ item: serializeBroadcastRunbookItem(row) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const id = cleanText(body.id, 128);
  const kind = cleanText(body.kind, 24);

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  if (kind === "clip") {
    const existing = await prisma.clipMarker.findUnique({ where: { id } });
    if (!existing || existing.tid !== tid) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.clipMarker.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const existing = await prisma.broadcastRunbookItem.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.broadcastRunbookItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

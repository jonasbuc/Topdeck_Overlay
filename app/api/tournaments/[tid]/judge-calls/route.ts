/**
 * Judge/help queue API.
 *
 * Players can request help from the public event page. The dashboard reads and
 * triages the queue without requiring any TopDeck-specific permissions.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeJudgeCall } from "@/lib/event-ops/serializers";
import {
  normalizeJudgeCategory,
  normalizeJudgePriority,
  normalizeJudgeStatus,
} from "@/lib/event-ops/types";

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
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const includeResolved = req.nextUrl.searchParams.get("all") === "true";

  const rows = await prisma.judgeCall.findMany({
    where: {
      tid,
      ...(includeResolved ? {} : { status: { not: "resolved" } }),
    },
    orderBy: { createdAt: "desc" },
    take: includeResolved ? 100 : 40,
  });

  return NextResponse.json({ calls: rows.map(serializeJudgeCall) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const tableNumber = cleanText(body.tableNumber, 24);
  const playerName = cleanText(body.playerName, 80);
  const message = cleanText(body.message, 300);
  const category = normalizeJudgeCategory(body.category);
  const priority = normalizeJudgePriority(body.priority);

  if (!tableNumber && !playerName && !message) {
    return NextResponse.json(
      { error: "request_detail_required" },
      { status: 400 }
    );
  }

  const row = await prisma.judgeCall.create({
    data: {
      tid,
      tableNumber: tableNumber || null,
      playerName: playerName || null,
      message: message || null,
      category,
      priority,
    },
  });

  return NextResponse.json({ call: serializeJudgeCall(row) }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const id = cleanText(body.id, 128);
  const requestedStatus =
    typeof body.status === "string" ? normalizeJudgeStatus(body.status) : null;
  const assignedTo =
    typeof body.assignedTo === "string"
      ? cleanText(body.assignedTo, 80) || null
      : undefined;
  const internalNote =
    typeof body.internalNote === "string"
      ? cleanText(body.internalNote, 500) || null
      : undefined;

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const existing = await prisma.judgeCall.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const status = requestedStatus ?? normalizeJudgeStatus(existing.status);
  const nextAcknowledgedAt =
    status === "acknowledged" && !existing.acknowledgedAt
      ? new Date()
      : status === "open"
      ? null
      : existing.acknowledgedAt;

  const row = await prisma.judgeCall.update({
    where: { id },
    data: {
      ...(requestedStatus ? { status } : {}),
      ...(typeof body.category === "string"
        ? { category: normalizeJudgeCategory(body.category) }
        : {}),
      ...(typeof body.priority === "string"
        ? { priority: normalizeJudgePriority(body.priority) }
        : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {}),
      ...(internalNote !== undefined ? { internalNote } : {}),
      ...(requestedStatus
        ? {
            acknowledgedAt:
              status === "resolved" && !nextAcknowledgedAt
                ? new Date()
                : nextAcknowledgedAt,
            resolvedAt: status === "resolved" ? new Date() : null,
          }
        : {}),
    },
  });

  return NextResponse.json({ call: serializeJudgeCall(row) });
}

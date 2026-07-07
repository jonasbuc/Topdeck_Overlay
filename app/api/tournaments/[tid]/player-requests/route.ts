/**
 * Player help desk API.
 *
 * Public event-page requests for non-judge operational help: lost items,
 * water, accessibility support, drops and general TO help.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePlayerRequest } from "@/lib/event-ops/serializers";
import {
  normalizeJudgePriority,
  normalizePlayerRequestStatus,
  normalizePlayerRequestType,
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
  const playerName = cleanText(req.nextUrl.searchParams.get("player"), 80);

  const rows = await prisma.playerRequest.findMany({
    where: {
      tid,
      ...(includeResolved ? {} : { status: { not: "resolved" } }),
      ...(playerName ? { playerName } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: includeResolved ? 100 : 40,
  });

  return NextResponse.json({ requests: rows.map(serializePlayerRequest) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const playerName = cleanText(body.playerName, 80);
  const tableNumber = cleanText(body.tableNumber, 24);
  const message = cleanText(body.message, 500);
  const type = normalizePlayerRequestType(body.type);
  const priority = normalizeJudgePriority(body.priority);

  if (!playerName && !tableNumber && !message) {
    return NextResponse.json(
      { error: "request_detail_required" },
      { status: 400 }
    );
  }

  const row = await prisma.playerRequest.create({
    data: {
      tid,
      type,
      playerName: playerName || null,
      tableNumber: tableNumber || null,
      message: message || null,
      priority,
    },
  });

  return NextResponse.json(
    { request: serializePlayerRequest(row) },
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
  const requestedStatus =
    typeof body.status === "string"
      ? normalizePlayerRequestStatus(body.status)
      : null;
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

  const existing = await prisma.playerRequest.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const status = requestedStatus ?? normalizePlayerRequestStatus(existing.status);
  const nextAcknowledgedAt =
    status === "acknowledged" && !existing.acknowledgedAt
      ? new Date()
      : status === "open"
      ? null
      : existing.acknowledgedAt;

  const row = await prisma.playerRequest.update({
    where: { id },
    data: {
      ...(requestedStatus ? { status } : {}),
      ...(typeof body.type === "string"
        ? { type: normalizePlayerRequestType(body.type) }
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

  return NextResponse.json({ request: serializePlayerRequest(row) });
}

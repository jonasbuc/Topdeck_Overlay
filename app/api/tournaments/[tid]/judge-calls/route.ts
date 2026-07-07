/**
 * Judge/help queue API.
 *
 * Players can request help from the public event page. The dashboard reads and
 * triages the queue without requiring any TopDeck-specific permissions.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeJudgeCall } from "@/lib/event-ops/serializers";
import { normalizeJudgeStatus } from "@/lib/event-ops/types";

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
  const status = normalizeJudgeStatus(body.status);

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const existing = await prisma.judgeCall.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = await prisma.judgeCall.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
    },
  });

  return NextResponse.json({ call: serializeJudgeCall(row) });
}

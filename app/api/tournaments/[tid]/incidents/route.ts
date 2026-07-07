/**
 * Incident log API.
 *
 * Private event log for penalties, appeals, slow play warnings, deck issues
 * and operational notes judges/TOs need to retain.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeIncidentLog } from "@/lib/event-ops/serializers";
import {
  normalizeIncidentCategory,
  normalizeIncidentSeverity,
  normalizeIncidentStatus,
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
  const includeClosed = req.nextUrl.searchParams.get("all") === "true";
  const rows = await prisma.incidentLog.findMany({
    where: {
      tid,
      ...(includeClosed ? {} : { status: "open" }),
    },
    orderBy: { createdAt: "desc" },
    take: includeClosed ? 100 : 50,
  });

  return NextResponse.json({ incidents: rows.map(serializeIncidentLog) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const playerName = cleanText(body.playerName, 80);
  const tableNumber = cleanText(body.tableNumber, 24);
  const category = normalizeIncidentCategory(body.category);
  const severity = normalizeIncidentSeverity(body.severity);
  const summary = cleanText(body.summary, 1000);
  const ruling = cleanText(body.ruling, 1000);
  const appealed = body.appealed === true;

  if (!summary) {
    return NextResponse.json({ error: "summary_required" }, { status: 400 });
  }

  const row = await prisma.incidentLog.create({
    data: {
      tid,
      playerName: playerName || null,
      tableNumber: tableNumber || null,
      category,
      severity,
      summary,
      ruling: ruling || null,
      appealed,
    },
  });

  return NextResponse.json(
    { incident: serializeIncidentLog(row) },
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

  const existing = await prisma.incidentLog.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = await prisma.incidentLog.update({
    where: { id },
    data: {
      ...(typeof body.playerName === "string"
        ? { playerName: cleanText(body.playerName, 80) || null }
        : {}),
      ...(typeof body.tableNumber === "string"
        ? { tableNumber: cleanText(body.tableNumber, 24) || null }
        : {}),
      ...(typeof body.category === "string"
        ? { category: normalizeIncidentCategory(body.category) }
        : {}),
      ...(typeof body.severity === "string"
        ? { severity: normalizeIncidentSeverity(body.severity) }
        : {}),
      ...(typeof body.summary === "string"
        ? { summary: cleanText(body.summary, 1000) || existing.summary }
        : {}),
      ...(typeof body.ruling === "string"
        ? { ruling: cleanText(body.ruling, 1000) || null }
        : {}),
      ...(typeof body.appealed === "boolean" ? { appealed: body.appealed } : {}),
      ...(typeof body.status === "string"
        ? { status: normalizeIncidentStatus(body.status) }
        : {}),
    },
  });

  return NextResponse.json({ incident: serializeIncidentLog(row) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const id = cleanText(body.id, 128);

  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const existing = await prisma.incidentLog.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.incidentLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

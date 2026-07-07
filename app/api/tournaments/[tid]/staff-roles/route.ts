/**
 * Staff roles API.
 *
 * Lightweight staff assignment board for judges, scorekeepers, coverage and
 * runners during an event.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeStaffAssignment } from "@/lib/event-ops/serializers";
import {
  normalizeStaffAssignmentStatus,
  normalizeStaffRole,
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
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const rows = await prisma.staffAssignment.findMany({
    where: { tid },
    orderBy: [{ status: "asc" }, { role: "asc" }, { staffName: "asc" }],
    take: 100,
  });

  return NextResponse.json({ assignments: rows.map(serializeStaffAssignment) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);
  const staffName = cleanText(body.staffName, 80);
  const role = normalizeStaffRole(body.role);
  const zone = cleanText(body.zone, 80);
  const tableNumber = cleanText(body.tableNumber, 24);
  const status = normalizeStaffAssignmentStatus(body.status);
  const note = cleanText(body.note, 300);

  if (!staffName) {
    return NextResponse.json({ error: "staff_name_required" }, { status: 400 });
  }

  const row = await prisma.staffAssignment.create({
    data: {
      tid,
      staffName,
      role,
      zone: zone || null,
      tableNumber: tableNumber || null,
      status,
      note: note || null,
    },
  });

  return NextResponse.json(
    { assignment: serializeStaffAssignment(row) },
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

  const existing = await prisma.staffAssignment.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = await prisma.staffAssignment.update({
    where: { id },
    data: {
      ...(typeof body.staffName === "string"
        ? { staffName: cleanText(body.staffName, 80) || existing.staffName }
        : {}),
      ...(typeof body.role === "string"
        ? { role: normalizeStaffRole(body.role) }
        : {}),
      ...(typeof body.zone === "string"
        ? { zone: cleanText(body.zone, 80) || null }
        : {}),
      ...(typeof body.tableNumber === "string"
        ? { tableNumber: cleanText(body.tableNumber, 24) || null }
        : {}),
      ...(typeof body.status === "string"
        ? { status: normalizeStaffAssignmentStatus(body.status) }
        : {}),
      ...(typeof body.note === "string"
        ? { note: cleanText(body.note, 300) || null }
        : {}),
    },
  });

  return NextResponse.json({ assignment: serializeStaffAssignment(row) });
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

  const existing = await prisma.staffAssignment.findUnique({ where: { id } });
  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.staffAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

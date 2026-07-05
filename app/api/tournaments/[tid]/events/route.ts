/**
 * GET /api/tournaments/[tid]/events
 *
 * Returns the raw webhook event log for a tournament, newest first.
 * Limited to 200 rows to avoid huge payloads.
 *
 * Response: Array of WebhookEvent rows (without the raw payload body to
 * keep the response small — add ?full=true to include it).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
): Promise<NextResponse> {
  const { tid } = await params;
  const includeFull = req.nextUrl.searchParams.get("full") === "true";

  const events = await prisma.webhookEvent.findMany({
    where: { tid },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      tid: true,
      type: true,
      apiVersion: true,
      createdAt: true,
      receivedAt: true,
      ...(includeFull && { rawPayload: true }),
    },
  });

  return NextResponse.json(events);
}

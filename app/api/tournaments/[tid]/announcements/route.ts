/**
 * Tournament announcements API.
 *
 * Announcements are created by organizers on the dashboard and shown on the
 * public player page and venue display. They can optionally be mirrored to
 * the linked Discord channel.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getLinkByTid } from "@/lib/discord/config-service";
import { sendDiscordMessage } from "@/lib/discord/rest";
import { serializeAnnouncement } from "@/lib/event-ops/serializers";
import {
  normalizeAudience,
  normalizeTone,
  type AnnouncementAudience,
  type AnnouncementTone,
} from "@/lib/event-ops/types";

export const dynamic = "force-dynamic";

const TONE_COLORS: Record<AnnouncementTone, number> = {
  info: 0x7c3aed,
  success: 0x22c55e,
  warning: 0xf59e0b,
  urgent: 0xef4444,
};

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

async function publishToDiscord(
  tid: string,
  announcement: {
    title: string;
    body: string;
    tone: AnnouncementTone;
    audience: AnnouncementAudience;
  }
): Promise<boolean> {
  if (!env.DISCORD_BOT_TOKEN) return false;
  const link = await getLinkByTid(tid);
  if (!link) return false;

  return sendDiscordMessage(env.DISCORD_BOT_TOKEN, link.channelId, {
    embeds: [
      {
        title: announcement.title,
        description: announcement.body,
        color: TONE_COLORS[announcement.tone],
        footer: { text: `TopDeck Live announcement · ${announcement.audience}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const includeArchived = req.nextUrl.searchParams.get("all") === "true";
  const audience = req.nextUrl.searchParams.get("audience");

  const rows = await prisma.tournamentAnnouncement.findMany({
    where: {
      tid,
      ...(includeArchived ? {} : { pinned: true }),
      ...(audience
        ? {
            OR: [
              { audience: "all" },
              { audience },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: includeArchived ? 50 : 8,
  });

  return NextResponse.json({
    announcements: rows.map(serializeAnnouncement),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const body = await readJson(req);

  const title = cleanText(body.title, 80);
  const announcementBody = cleanText(body.body, 1000);
  const tone = normalizeTone(body.tone);
  const audience = normalizeAudience(body.audience);
  const pinned = body.pinned !== false;
  const shouldPublishToDiscord = body.publishToDiscord === true;

  if (!title || !announcementBody) {
    return NextResponse.json(
      { error: "title_body_required" },
      { status: 400 }
    );
  }

  const row = await prisma.tournamentAnnouncement.create({
    data: {
      tid,
      title,
      body: announcementBody,
      tone,
      audience,
      pinned,
    },
  });

  let finalRow = row;
  let discordPublished = false;
  if (shouldPublishToDiscord) {
    discordPublished = await publishToDiscord(tid, {
      title,
      body: announcementBody,
      tone,
      audience,
    });
    if (discordPublished) {
      finalRow = await prisma.tournamentAnnouncement.update({
        where: { id: row.id },
        data: { publishedToDiscordAt: new Date() },
      });
    }
  }

  return NextResponse.json(
    {
      announcement: serializeAnnouncement(finalRow),
      discordPublished,
    },
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

  const existing = await prisma.tournamentAnnouncement.findUnique({
    where: { id },
  });

  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const row = await prisma.tournamentAnnouncement.update({
    where: { id },
    data: {
      ...(typeof body.title === "string"
        ? { title: cleanText(body.title, 80) }
        : {}),
      ...(typeof body.body === "string"
        ? { body: cleanText(body.body, 1000) }
        : {}),
      ...(typeof body.tone === "string"
        ? { tone: normalizeTone(body.tone) }
        : {}),
      ...(typeof body.audience === "string"
        ? { audience: normalizeAudience(body.audience) }
        : {}),
      ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
    },
  });

  return NextResponse.json({ announcement: serializeAnnouncement(row) });
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

  const existing = await prisma.tournamentAnnouncement.findUnique({
    where: { id },
  });

  if (!existing || existing.tid !== tid) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.tournamentAnnouncement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

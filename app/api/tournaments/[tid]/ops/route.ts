/**
 * Tournament operations health API.
 *
 * Gives the dashboard a compact, read-only picture of the integration state:
 * latest webhook, DB snapshot freshness, Discord link, parking cache and
 * important environment toggles.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getLinkByTid } from "@/lib/discord/config-service";
import { buildCacheKey } from "@/lib/parking/cache";
import { getTournamentState } from "@/lib/topdeck/tournament-state";

export const dynamic = "force-dynamic";

type ParkingCacheHealth =
  | {
      status: "fresh" | "expired";
      provider: string;
      resultCount: number;
      fetchedAt: string;
      expiresAt: string;
      cacheKey: string;
    }
  | {
      status: "missing";
      cacheKey: string | null;
    }
  | {
      status: "no_coordinates";
      cacheKey: null;
    };

function parseResultCount(raw: string): number {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  const { tid } = await params;
  const [state, eventCount, latestEvent, recentEvents, discordLink] =
    await Promise.all([
      getTournamentState(tid),
      prisma.webhookEvent.count({ where: { tid } }),
      prisma.webhookEvent.findFirst({
        where: { tid },
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          type: true,
          apiVersion: true,
          createdAt: true,
          receivedAt: true,
        },
      }),
      prisma.webhookEvent.findMany({
        where: { tid },
        orderBy: { receivedAt: "desc" },
        take: 6,
        select: {
          id: true,
          type: true,
          apiVersion: true,
          createdAt: true,
          receivedAt: true,
        },
      }),
      getLinkByTid(tid),
    ]);

  const [
    announcementCount,
    pinnedAnnouncementCount,
    latestAnnouncement,
    floorMap,
    judgeCalls,
    playerRequests,
    staffAssignments,
    incidentCount,
    openIncidentCount,
    broadcastItems,
    clipCount,
  ] = await Promise.all([
      prisma.tournamentAnnouncement.count({ where: { tid } }),
      prisma.tournamentAnnouncement.count({ where: { tid, pinned: true } }),
      prisma.tournamentAnnouncement.findFirst({
        where: { tid },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, audience: true, createdAt: true },
      }),
      prisma.tournamentFloorMap.findUnique({ where: { tid } }),
      prisma.judgeCall.findMany({
        where: { tid },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
      prisma.playerRequest.findMany({
        where: { tid },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          priority: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.staffAssignment.findMany({
        where: { tid },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          role: true,
          status: true,
        },
      }),
      prisma.incidentLog.count({ where: { tid } }),
      prisma.incidentLog.count({ where: { tid, status: "open" } }),
      prisma.broadcastRunbookItem.findMany({
        where: { tid },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 100,
        select: {
          id: true,
          status: true,
          segment: true,
        },
      }),
      prisma.clipMarker.count({ where: { tid } }),
    ]);

  const openJudgeCalls = judgeCalls.filter((call) => call.status === "open");
  const acknowledgedJudgeCalls = judgeCalls.filter(
    (call) => call.status === "acknowledged"
  );
  const unresolvedJudgeCalls = judgeCalls.filter(
    (call) => call.status !== "resolved"
  );
  const urgentJudgeCalls = unresolvedJudgeCalls.filter(
    (call) => call.priority === "urgent"
  );
  const openPlayerRequests = playerRequests.filter(
    (request) => request.status === "open"
  );
  const unresolvedPlayerRequests = playerRequests.filter(
    (request) => request.status !== "resolved"
  );
  const urgentPlayerRequests = unresolvedPlayerRequests.filter(
    (request) => request.priority === "urgent"
  );
  const activeStaffAssignments = staffAssignments.filter(
    (assignment) => assignment.status === "active"
  );
  const liveBroadcastItems = broadcastItems.filter((item) => item.status === "live");
  const queuedBroadcastItems = broadcastItems.filter(
    (item) => item.status === "queued"
  );
  const tables = state?.tables ?? [];
  const completedTables = tables.filter((table) => table.status === "Completed").length;
  const activeTables = tables.filter((table) => table.status === "Active").length;
  const pendingTables = tables.filter((table) => table.status === "Pending").length;
  const byeTables = tables.filter((table) => table.status === "Bye").length;

  let floorZoneCount = 0;
  if (floorMap) {
    try {
      const zones = JSON.parse(floorMap.zones);
      floorZoneCount = Array.isArray(zones) ? zones.length : 0;
    } catch {
      floorZoneCount = 0;
    }
  }

  let parkingCache: ParkingCacheHealth = {
    status: "no_coordinates",
    cacheKey: null,
  };

  const lat = state?.location?.lat;
  const lng = state?.location?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    const cacheKey = buildCacheKey(lat, lng);
    const row = await prisma.parkingCache.findUnique({ where: { cacheKey } });
    parkingCache = row
      ? {
          status: row.expiresAt > new Date() ? "fresh" : "expired",
          provider: row.provider,
          resultCount: parseResultCount(row.results),
          fetchedAt: row.fetchedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          cacheKey,
        }
      : { status: "missing", cacheKey };
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      state: state
        ? {
            exists: true,
            tid: state.tid,
            name: state.name,
            status: state.status,
            roundStatus: state.roundStatus,
            roundLabel: state.roundLabel,
            updatedAt: state.updatedAt,
            lastEventId: state.lastEventId,
            lastEventCreated: state.lastEventCreated,
            hasLocation: state.location != null,
            hasCoordinates:
              typeof state.location?.lat === "number" &&
              typeof state.location?.lng === "number",
          }
        : { exists: false, tid },
      webhooks: {
        eventCount,
        latestEvent,
        recentEvents,
      },
      discord: {
        env: {
          botTokenConfigured: env.DISCORD_BOT_TOKEN != null,
          clientIdConfigured: env.DISCORD_CLIENT_ID != null,
          publicKeyConfigured: env.DISCORD_PUBLIC_KEY != null,
          guildIdConfigured: env.DISCORD_GUILD_ID != null,
        },
        link: discordLink
          ? {
              guildId: discordLink.guildId,
              channelId: discordLink.channelId,
              settings: discordLink.settings,
              updatedAt: discordLink.updatedAt.toISOString(),
            }
          : null,
      },
      topdeck: {
        apiKeyConfigured: env.TOPDECK_API_KEY != null,
      },
      parking: {
        provider: env.PARKING_PROVIDER,
        googleMapsKeyConfigured: env.GOOGLE_MAPS_API_KEY != null,
        cache: parkingCache,
      },
      eventOps: {
        round: {
          tableCount: tables.length,
          completed: completedTables,
          active: activeTables,
          pending: pendingTables,
          byes: byeTables,
          completionRate:
            tables.length > 0 ? completedTables / Math.max(1, tables.length - byeTables) : null,
        },
        announcements: {
          total: announcementCount,
          pinned: pinnedAnnouncementCount,
          latest: latestAnnouncement
            ? {
                id: latestAnnouncement.id,
                title: latestAnnouncement.title,
                audience: latestAnnouncement.audience,
                createdAt: latestAnnouncement.createdAt.toISOString(),
              }
            : null,
        },
        floorMap: {
          configured: floorZoneCount > 0,
          zoneCount: floorZoneCount,
          updatedAt: floorMap?.updatedAt.toISOString() ?? null,
        },
        judgeQueue: {
          open: openJudgeCalls.length,
          acknowledged: acknowledgedJudgeCalls.length,
          unresolved: unresolvedJudgeCalls.length,
          urgent: urgentJudgeCalls.length,
          oldestOpenAt:
            openJudgeCalls.length > 0
              ? openJudgeCalls
                  .slice()
                  .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
                  .createdAt.toISOString()
              : null,
        },
        playerRequests: {
          open: openPlayerRequests.length,
          unresolved: unresolvedPlayerRequests.length,
          urgent: urgentPlayerRequests.length,
          oldestOpenAt:
            openPlayerRequests.length > 0
              ? openPlayerRequests
                  .slice()
                  .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
                  .createdAt.toISOString()
              : null,
        },
        staff: {
          total: staffAssignments.length,
          active: activeStaffAssignments.length,
          onBreak: staffAssignments.filter((assignment) => assignment.status === "break")
            .length,
          offline: staffAssignments.filter((assignment) => assignment.status === "offline")
            .length,
        },
        incidents: {
          total: incidentCount,
          open: openIncidentCount,
        },
        broadcast: {
          runbookItems: broadcastItems.length,
          liveItems: liveBroadcastItems.length,
          queuedItems: queuedBroadcastItems.length,
          clipMarkers: clipCount,
        },
      },
      links: {
        player: `/event/${tid}`,
        to: `/to/${tid}`,
        dashboard: `/dashboard/${tid}`,
        overlays: `/overlay/${tid}`,
        venue: `/venue/${tid}`,
        analytics: `/analytics/${tid}`,
        judge: `/judge/${tid}`,
        producer: `/producer/${tid}`,
        recap: `/recap/${tid}`,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

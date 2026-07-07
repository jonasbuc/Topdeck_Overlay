"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface OpsEvent {
  id: string;
  type: string;
  apiVersion: string;
  createdAt: string;
  receivedAt: string;
}

interface OpsHealth {
  generatedAt: string;
  state:
    | {
        exists: true;
        tid: string;
        name: string;
        status: string;
        roundStatus: string;
        roundLabel: string;
        updatedAt: string;
        lastEventId: string;
        lastEventCreated: number;
        hasLocation: boolean;
        hasCoordinates: boolean;
      }
    | { exists: false; tid: string };
  webhooks: {
    eventCount: number;
    latestEvent: OpsEvent | null;
    recentEvents: OpsEvent[];
  };
  discord: {
    env: {
      botTokenConfigured: boolean;
      clientIdConfigured: boolean;
      publicKeyConfigured: boolean;
      guildIdConfigured: boolean;
    };
    link: {
      guildId: string;
      channelId: string;
      updatedAt: string;
    } | null;
  };
  topdeck: {
    apiKeyConfigured: boolean;
  };
  parking: {
    provider: string;
    googleMapsKeyConfigured: boolean;
    cache:
      | {
          status: "fresh" | "expired";
          provider: string;
          resultCount: number;
          fetchedAt: string;
          expiresAt: string;
          cacheKey: string;
        }
      | { status: "missing"; cacheKey: string | null }
      | { status: "no_coordinates"; cacheKey: null };
  };
  eventOps: {
    announcements: {
      total: number;
      pinned: number;
      latest: {
        id: string;
        title: string;
        audience: string;
        createdAt: string;
      } | null;
    };
    floorMap: {
      configured: boolean;
      zoneCount: number;
      updatedAt: string | null;
    };
    judgeQueue: {
      open: number;
      acknowledged: number;
      unresolved: number;
      urgent: number;
      oldestOpenAt: string | null;
    };
  };
  links: {
    player: string;
    dashboard: string;
    overlays: string;
    venue: string;
    analytics: string;
    producer: string;
    recap: string;
  };
}

function formatTime(value: string | number | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function healthClass(ok: boolean): string {
  return ok ? "ok" : "warn";
}

function discordUrl(link: OpsHealth["discord"]["link"]): string | null {
  if (!link) return null;
  return `https://discord.com/channels/${link.guildId}/${link.channelId}`;
}

function minutesSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / 60_000));
}

export function TournamentOpsPanel({ tid }: { tid: string }) {
  const [health, setHealth] = useState<OpsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`/api/tournaments/${tid}/ops`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OpsHealth | null) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [tid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleResync = async () => {
    setMessage("Syncing...");
    try {
      const res = await fetch(`/api/tournaments/${tid}/resync`, { method: "POST" });
      const body = (await res.json()) as { message?: string };
      setMessage(body.message ?? (res.ok ? "Synced" : "Sync failed"));
      refresh();
    } catch {
      setMessage("Sync failed");
    }
  };

  const stateOk = health?.state.exists === true;
  const latestWebhookAge = minutesSince(health?.webhooks.latestEvent?.receivedAt);
  const stateAge = minutesSince(
    health?.state.exists ? health.state.updatedAt : null
  );
  const webhookOk = (health?.webhooks.eventCount ?? 0) > 0;
  const discordOk =
    health?.discord.env.botTokenConfigured === true &&
    health.discord.env.clientIdConfigured === true &&
    health.discord.env.publicKeyConfigured === true;
  const parkingOk =
    health?.parking.cache.status === "fresh" ||
    health?.parking.cache.status === "missing";
  const floorMapOk = health?.eventOps.floorMap.configured === true;
  const announcementOk = (health?.eventOps.announcements.pinned ?? 0) > 0;
  const queueOk = (health?.eventOps.judgeQueue.urgent ?? 0) === 0;
  const channelUrl = health ? discordUrl(health.discord.link) : null;
  const readiness = health
    ? [
        {
          label: "Tournament data",
          ok: stateOk && (stateAge == null || stateAge < 20),
          detail: stateAge == null ? "No state yet" : `Updated ${stateAge} min ago`,
        },
        {
          label: "TopDeck webhook",
          ok: webhookOk,
          detail:
            latestWebhookAge == null
              ? "No events yet"
              : `Latest ${latestWebhookAge} min ago`,
        },
        {
          label: "Discord channel",
          ok: health.discord.link != null,
          detail: health.discord.link ? "Linked" : "Run /topdeck setup",
        },
        {
          label: "Player page",
          ok: true,
          detail: health.links.player,
        },
        {
          label: "Venue display",
          ok: floorMapOk,
          detail: floorMapOk
            ? `${health.eventOps.floorMap.zoneCount} floor zones`
            : "Configure table map",
        },
        {
          label: "Announcements",
          ok: announcementOk,
          detail: announcementOk
            ? `${health.eventOps.announcements.pinned} pinned`
            : "Post first announcement",
        },
        {
          label: "Judge queue",
          ok: queueOk,
          detail:
            health.eventOps.judgeQueue.unresolved === 0
              ? "No active calls"
              : `${health.eventOps.judgeQueue.unresolved} active / ${health.eventOps.judgeQueue.urgent} urgent`,
        },
        {
          label: "Parking",
          ok: parkingOk,
          detail: health.parking.cache.status,
        },
      ]
    : [];
  const blockedCount = readiness.filter((item) => !item.ok).length;

  return (
    <details className="card ops-panel" open>
      <summary className="ops-summary">
        <span>Event-day Control Center</span>
        <span className="ops-summary-badges">
          <span className={`ops-health-dot ${healthClass(stateOk)}`} />
          <span className={`ops-health-dot ${healthClass(webhookOk)}`} />
          <span className={`ops-health-dot ${healthClass(discordOk)}`} />
          <span className={`ops-health-dot ${healthClass(parkingOk)}`} />
          {health && (
            <span className={`ops-readiness-pill ${blockedCount === 0 ? "ready" : ""}`}>
              {blockedCount === 0 ? "Ready" : `${blockedCount} checks`}
            </span>
          )}
        </span>
      </summary>

      <div className="ops-toolbar">
        <button type="button" className="ops-btn" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button type="button" className="ops-btn primary" onClick={handleResync}>
          Resync TopDeck
        </button>
        {message && <span className="ops-message">{message}</span>}
      </div>

      {!health && !loading && (
        <p className="empty-state">Could not load operations health.</p>
      )}

      {health && (
        <>
          <div className="ops-checklist">
            {readiness.map((item) => (
              <div key={item.label} className={`ops-check-row ${item.ok ? "ok" : "warn"}`}>
                <span>{item.ok ? "OK" : "Check"}</span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>

          <div className="ops-grid">
            <div className="ops-tile">
              <span className="ops-tile-label">State</span>
              <strong>{health.state.exists ? health.state.status : "Missing"}</strong>
              <span>
                {health.state.exists
                  ? `${health.state.roundLabel || "No round"} / ${health.state.roundStatus}`
                  : "No DB snapshot"}
              </span>
              <small>
                Updated {health.state.exists ? formatTime(health.state.updatedAt) : "-"}
              </small>
            </div>

            <div className="ops-tile">
              <span className="ops-tile-label">Webhooks</span>
              <strong>{health.webhooks.eventCount}</strong>
              <span>{health.webhooks.latestEvent?.type ?? "No events yet"}</span>
              <small>
                Latest {formatTime(health.webhooks.latestEvent?.receivedAt)}
              </small>
            </div>

            <div className="ops-tile">
              <span className="ops-tile-label">Discord</span>
              <strong>{health.discord.link ? "Linked" : "Not linked"}</strong>
              {channelUrl ? (
                <a href={channelUrl} target="_blank" rel="noreferrer">
                  Open channel
                </a>
              ) : (
                <span>{discordOk ? "Bot configured" : "Env incomplete"}</span>
              )}
              <small>
                Token {health.discord.env.botTokenConfigured ? "ok" : "missing"} /
                Key {health.discord.env.publicKeyConfigured ? "ok" : "missing"}
              </small>
            </div>

            <div className="ops-tile">
              <span className="ops-tile-label">Judge Queue</span>
              <strong>{health.eventOps.judgeQueue.unresolved}</strong>
              <span>
                {health.eventOps.judgeQueue.open} open /{" "}
                {health.eventOps.judgeQueue.acknowledged} acknowledged
              </span>
              <small>
                {health.eventOps.judgeQueue.urgent} urgent · oldest{" "}
                {formatTime(health.eventOps.judgeQueue.oldestOpenAt)}
              </small>
            </div>

            <div className="ops-tile">
              <span className="ops-tile-label">Event Ops</span>
              <strong>{health.eventOps.floorMap.zoneCount} zones</strong>
              <span>{health.eventOps.announcements.pinned} pinned announcements</span>
              <small>
                Latest: {health.eventOps.announcements.latest?.title ?? "none"}
              </small>
            </div>

            <div className="ops-tile">
              <span className="ops-tile-label">Parking</span>
              <strong>{health.parking.cache.status}</strong>
              <span>{health.parking.provider}</span>
              <small>
                {"resultCount" in health.parking.cache
                  ? `${health.parking.cache.resultCount} cached results`
                  : health.parking.cache.cacheKey ?? "No venue coordinates"}
              </small>
            </div>
          </div>

          <div className="ops-links">
            <Link href={health.links.player} target="_blank">Player page</Link>
            <Link href={health.links.overlays} target="_blank">Overlays</Link>
            <Link href={health.links.venue} target="_blank">Venue display</Link>
            <Link href={health.links.producer} target="_blank">Producer mode</Link>
            <Link href={health.links.analytics}>Analytics</Link>
            <Link href={health.links.recap}>Recap</Link>
          </div>

          <div className="ops-events">
            {health.webhooks.recentEvents.map((event) => (
              <div key={event.id} className="ops-event-row">
                <span>{event.type}</span>
                <small>{formatTime(event.receivedAt)}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </details>
  );
}

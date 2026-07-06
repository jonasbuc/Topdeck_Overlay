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
  links: {
    player: string;
    dashboard: string;
    overlays: string;
    venue: string;
    analytics: string;
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
  const webhookOk = (health?.webhooks.eventCount ?? 0) > 0;
  const discordOk =
    health?.discord.env.botTokenConfigured === true &&
    health.discord.env.clientIdConfigured === true &&
    health.discord.env.publicKeyConfigured === true;
  const parkingOk =
    health?.parking.cache.status === "fresh" ||
    health?.parking.cache.status === "missing";
  const channelUrl = health ? discordUrl(health.discord.link) : null;

  return (
    <details className="card ops-panel">
      <summary className="ops-summary">
        <span>Ops Health</span>
        <span className="ops-summary-badges">
          <span className={`ops-health-dot ${healthClass(stateOk)}`} />
          <span className={`ops-health-dot ${healthClass(webhookOk)}`} />
          <span className={`ops-health-dot ${healthClass(discordOk)}`} />
          <span className={`ops-health-dot ${healthClass(parkingOk)}`} />
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
            <Link href={health.links.analytics}>Analytics</Link>
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

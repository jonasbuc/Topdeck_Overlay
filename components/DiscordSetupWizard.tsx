"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscordTournamentSettings } from "@/lib/discord/types";

interface DiscordSetupResponse {
  linked: boolean;
  link: {
    tid: string;
    guildId: string;
    channelId: string;
    settings: DiscordTournamentSettings;
    createdAt: string;
    updatedAt: string;
  } | null;
  defaults: DiscordTournamentSettings;
}

const SETTING_LABELS: Array<{
  key: Exclude<keyof DiscordTournamentSettings, "topNStandings">;
  label: string;
  detail: string;
}> = [
  {
    key: "postPairings",
    label: "Pairings",
    detail: "Post when a round is published.",
  },
  {
    key: "postRoundStarted",
    label: "Round start",
    detail: "Post timer and round status.",
  },
  {
    key: "postStandings",
    label: "Standings",
    detail: "Post after each completed round.",
  },
  {
    key: "postParking",
    label: "Parking",
    detail: "Post venue parking at check-in.",
  },
  {
    key: "postResults",
    label: "Results",
    detail: "Post match result updates.",
  },
  {
    key: "mentionPlayers",
    label: "Mentions",
    detail: "Mention players when Discord IDs are available.",
  },
];

function channelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function DiscordSetupWizard({ tid }: { tid: string }) {
  const [data, setData] = useState<DiscordSetupResponse | null>(null);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [settings, setSettings] = useState<DiscordTournamentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/tournaments/${tid}/discord`)
      .then((res) => (res.ok ? res.json() : null))
      .then((next: DiscordSetupResponse | null) => {
        setData(next);
        setGuildId(next?.link?.guildId ?? "");
        setChannelId(next?.link?.channelId ?? "");
        setSettings(next?.link?.settings ?? next?.defaults ?? null);
      })
      .catch(() => setData(null));
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const saveLink = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/discord`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, channelId, settings }),
      });
      if (!res.ok) throw new Error("save_failed");
      setData((await res.json()) as DiscordSetupResponse);
      setMessage("Discord link saved.");
      load();
    } catch {
      setMessage("Could not save Discord link.");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/discord`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("settings_failed");
      setData((await res.json()) as DiscordSetupResponse);
      setMessage("Notification settings saved.");
      load();
    } catch {
      setMessage("Could not save notification settings.");
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tid}/discord`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("unlink_failed");
      setData((await res.json()) as DiscordSetupResponse);
      setGuildId("");
      setChannelId("");
      setMessage("Discord link removed.");
      load();
    } catch {
      setMessage("Could not remove Discord link.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof DiscordTournamentSettings>(
    key: K,
    value: DiscordTournamentSettings[K]
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const linkedUrl =
    data?.link != null ? channelUrl(data.link.guildId, data.link.channelId) : null;

  return (
    <details className="card discord-wizard">
      <summary className="discord-wizard-summary">
        <span>Discord Setup</span>
        <span className={`discord-wizard-state ${data?.linked ? "linked" : ""}`}>
          {data?.linked ? "Linked" : "Not linked"}
        </span>
      </summary>

      <div className="wizard-steps">
        <span className={data?.linked ? "done" : "active"}>1. Link</span>
        <span className={data?.linked ? "active" : ""}>2. Automations</span>
        <span>3. Verify</span>
      </div>

      <div className="discord-command-box">
        <code>/topdeck setup tid:{tid}</code>
        <code>/topdeck link tid:{tid}</code>
      </div>

      <div className="discord-form-grid">
        <label>
          <span>Guild ID</span>
          <input
            value={guildId}
            onChange={(event) => setGuildId(event.target.value)}
            placeholder="Discord server ID"
          />
        </label>
        <label>
          <span>Channel ID</span>
          <input
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            placeholder="Discord channel ID"
          />
        </label>
      </div>

      <div className="discord-action-row">
        <button
          type="button"
          className="ops-btn primary"
          onClick={saveLink}
          disabled={saving || !guildId || !channelId}
        >
          {data?.linked ? "Update link" : "Save link"}
        </button>
        {linkedUrl && (
          <a href={linkedUrl} target="_blank" rel="noreferrer" className="ops-btn as-link">
            Open channel
          </a>
        )}
        {data?.linked && (
          <button type="button" className="ops-btn danger" onClick={unlink} disabled={saving}>
            Unlink
          </button>
        )}
      </div>

      {settings && (
        <div className="discord-settings-grid">
          {SETTING_LABELS.map((setting) => (
            <label key={setting.key} className="discord-toggle-row">
              <span>
                <strong>{setting.label}</strong>
                <small>{setting.detail}</small>
              </span>
              <input
                type="checkbox"
                checked={settings[setting.key]}
                onChange={(event) =>
                  updateSetting(setting.key, event.target.checked)
                }
              />
            </label>
          ))}

          <label className="discord-number-row">
            <span>
              <strong>Standings depth</strong>
              <small>0 posts all players.</small>
            </span>
            <input
              type="number"
              min={0}
              max={64}
              value={settings.topNStandings}
              onChange={(event) =>
                updateSetting(
                  "topNStandings",
                  Number.parseInt(event.target.value || "0", 10)
                )
              }
            />
          </label>
        </div>
      )}

      <div className="discord-action-row">
        <button
          type="button"
          className="ops-btn"
          onClick={saveSettings}
          disabled={saving || !data?.linked}
        >
          Save automations
        </button>
        {message && <span className="ops-message">{message}</span>}
      </div>
    </details>
  );
}

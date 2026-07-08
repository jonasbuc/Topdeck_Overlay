"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { BroadcastRunbookPanel } from "@/components/EventOpsAdvanced";
import {
  RoleExperienceShell,
  RoleWorkflowSection,
  useRolePreferences,
  type RoleAlert,
  type RoleCommandAction,
  type RoleStatusCard,
  type RoleWorkflowTab,
} from "@/components/RoleExperienceShell";
import type { TopDeckTable } from "@/lib/topdeck/types";

interface Props {
  tid: string;
}

type ProducerScene =
  | "full"
  | "clock"
  | "pairings"
  | "standings"
  | "ticker"
  | "winner"
  | "venue"
  | "feature";

const SCENES: Array<{ id: ProducerScene; label: string }> = [
  { id: "full", label: "Full" },
  { id: "clock", label: "Clock" },
  { id: "pairings", label: "Pairings" },
  { id: "standings", label: "Standings" },
  { id: "ticker", label: "Ticker" },
  { id: "feature", label: "Feature" },
  { id: "winner", label: "Winner" },
  { id: "venue", label: "Venue" },
];

function tableLabel(table: TopDeckTable): string {
  return table.table === "Byes" ? "Byes" : `Table ${table.table}`;
}

function scenePath(tid: string, scene: ProducerScene, featureTable: string): string {
  if (scene === "venue") return `/venue/${tid}`;
  if (scene === "feature" && featureTable) {
    return `/overlay/${tid}/feature/${featureTable}`;
  }
  return `/overlay/${tid}/${scene}`;
}

function playerRecordLabel(
  state: ReturnType<typeof useTournamentLive>["state"],
  playerId: string,
  playerName: string
): string {
  const standing = state?.standings.find(
    (entry) =>
      entry.id === playerId ||
      entry.name.trim().toLowerCase() === playerName.trim().toLowerCase()
  );
  return standing ? `#${standing.standing} · ${standing.points} pts` : "Record pending";
}

export function ProducerMode({ tid }: Props) {
  const { state, connected, error } = useTournamentLive(tid);
  const {
    activeTab: producerActiveTab,
    viewMode: producerViewMode,
    density: producerDensity,
    setActiveTab: setProducerActiveTab,
    setViewMode: setProducerViewMode,
    setDensity: setProducerDensity,
  } = useRolePreferences(`topdeck-live:${tid}:producer-ux`, "scenes");
  const [origin, setOrigin] = useState("");
  const [scene, setScene] = useState<ProducerScene>("full");
  const [featureTable, setFeatureTable] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [lowerTitle, setLowerTitle] = useState("");
  const [lowerSubtitle, setLowerSubtitle] = useState("");
  const [sponsorLine, setSponsorLine] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [autoOpenedProducerSignal, setAutoOpenedProducerSignal] = useState<
    string | null
  >(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const tables = useMemo(
    () => (state?.tables ?? []).filter((table) => table.table !== "Byes"),
    [state?.tables]
  );

  useEffect(() => {
    if (!featureTable && tables[0] && typeof tables[0].table === "number") {
      setFeatureTable(String(tables[0].table));
    }
  }, [featureTable, tables]);

  const path = scenePath(tid, scene, featureTable);
  const baseUrl = origin || "http://localhost:3000";
  const url = `${baseUrl}${path}`;
  const selectedFeatureTable =
    tables.find((table) => String(table.table) === featureTable) ?? tables[0] ?? null;
  const lowerThirdUrl = `${baseUrl}/overlay/${tid}/lower-third?title=${encodeURIComponent(
    lowerTitle
  )}&subtitle=${encodeURIComponent(lowerSubtitle)}&sponsor=${encodeURIComponent(sponsorLine)}`;
  const sceneSuggestions = [
    ...(state?.finished
      ? [{ scene: "winner" as ProducerScene, label: "Winner available" }]
      : []),
    ...(state?.roundStatus === "ended"
      ? [{ scene: "standings" as ProducerScene, label: "Round ended: show standings" }]
      : []),
    ...(selectedFeatureTable?.status === "Active"
      ? [{ scene: "feature" as ProducerScene, label: "Feature match is active" }]
      : []),
    ...(state && state.tables.length === 0
      ? [{ scene: "clock" as ProducerScene, label: "Waiting: show clock" }]
      : []),
    { scene: "ticker" as ProducerScene, label: "Results ticker for break" },
  ].slice(0, 4);

  useEffect(() => {
    const signal = state?.finished
      ? "winner"
      : state?.roundStatus === "ended"
      ? "standings"
      : selectedFeatureTable?.status === "Active"
      ? "feature"
      : null;
    if (!signal || signal === autoOpenedProducerSignal) return;
    setScene(signal === "feature" ? "feature" : (signal as ProducerScene));
    setProducerActiveTab(signal === "feature" ? "script" : "scenes");
    setAutoOpenedProducerSignal(signal);
  }, [
    autoOpenedProducerSignal,
    selectedFeatureTable?.status,
    setProducerActiveTab,
    state?.finished,
    state?.roundStatus,
  ]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(
      () => {
        setMessage("Copied");
        window.setTimeout(() => setMessage(null), 1400);
      },
      () => setMessage("Copy failed")
    );
  };

  const postAnnouncement = async () => {
    if (!announcement.trim()) return;
    setMessage("Posting...");
    try {
      const res = await fetch(`/api/tournaments/${tid}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Stream update",
          body: announcement,
          tone: "info",
          audience: "venue",
          pinned: true,
        }),
      });
      if (!res.ok) throw new Error("announcement_failed");
      setAnnouncement("");
      setMessage("Venue announcement posted");
    } catch {
      setMessage("Could not post announcement");
    }
  };
  const producerTabs: RoleWorkflowTab[] = [
    {
      id: "scenes",
      label: "Scenes",
      detail: scene,
      tone: state?.roundStatus === "ended" || state?.finished ? "warning" : "neutral",
    },
    {
      id: "script",
      label: "Script",
      detail: selectedFeatureTable ? tableLabel(selectedFeatureTable) : "No table",
      tone: selectedFeatureTable ? "good" : "warning",
    },
    {
      id: "lower-third",
      label: "Lower Third",
      detail: lowerTitle || "Builder",
      tone: lowerTitle ? "good" : "neutral",
    },
    {
      id: "runbook",
      label: "Runbook",
      detail: "Segments and clips",
      tone: "neutral",
    },
  ];
  const producerStatusCards: RoleStatusCard[] = [
    {
      id: "round",
      label: "Round",
      value: state?.roundLabel || "Waiting",
      detail: state?.roundStatus ?? "Loading",
      tone: state?.roundStatus === "active" ? "live" : "neutral",
    },
    {
      id: "scene",
      label: "Scene",
      value: scene,
      detail: path,
      tone: "good",
      href: "#producer-scenes",
      onSelect: () => setProducerActiveTab("scenes"),
    },
    {
      id: "feature",
      label: "Feature",
      value: selectedFeatureTable ? tableLabel(selectedFeatureTable) : "-",
      detail: selectedFeatureTable?.status ?? "No feature table",
      tone: selectedFeatureTable?.status === "Active" ? "live" : "neutral",
      href: "#producer-script",
      onSelect: () => setProducerActiveTab("script"),
    },
    {
      id: "next",
      label: "Next Action",
      value:
        state?.finished
          ? "Show winner"
          : state?.roundStatus === "ended"
          ? "Show standings"
          : selectedFeatureTable?.status === "Active"
          ? "Read script"
          : "Hold overlay",
      detail: sceneSuggestions[0]?.label ?? "Sources are ready",
      tone: state?.finished || state?.roundStatus === "ended" ? "warning" : "neutral",
      href: "#producer-scenes",
      onSelect: () => setProducerActiveTab("scenes"),
    },
    {
      id: "quick",
      label: "Quick Action",
      value: "Copy source",
      detail: "Current OBS URL",
      tone: "neutral",
      href: "#producer-scenes",
      onSelect: () => {
        setProducerActiveTab("scenes");
        copy(url);
      },
    },
  ];
  const producerAlerts: RoleAlert[] = [
    ...(state?.finished
      ? [
          {
            id: "winner",
            label: "Winner available",
            detail: "Switch to winner scene",
            tone: "warning" as const,
            href: "#producer-scenes",
            onSelect: () => {
              setScene("winner");
              setProducerActiveTab("scenes");
            },
          },
        ]
      : []),
    ...(state?.roundStatus === "ended"
      ? [
          {
            id: "round-ended",
            label: "Round ended",
            detail: "Standings scene is recommended",
            tone: "warning" as const,
            href: "#producer-scenes",
            onSelect: () => {
              setScene("standings");
              setProducerActiveTab("scenes");
            },
          },
        ]
      : []),
    ...(selectedFeatureTable?.status === "Active"
      ? [
          {
            id: "feature-active",
            label: "Feature match active",
            detail: tableLabel(selectedFeatureTable),
            tone: "live" as const,
            href: "#producer-script",
            onSelect: () => setProducerActiveTab("script"),
          },
        ]
      : []),
  ];
  const producerActions: RoleCommandAction[] = [
    {
      id: "scene-full",
      label: "Show full overlay",
      detail: "Switch scene and copy current source",
      href: "#producer-scenes",
      onSelect: () => {
        setScene("full");
        setProducerActiveTab("scenes");
      },
    },
    {
      id: "scene-standings",
      label: "Show standings",
      detail: "Switch scene",
      href: "#producer-scenes",
      onSelect: () => {
        setScene("standings");
        setProducerActiveTab("scenes");
      },
    },
    {
      id: "scene-feature",
      label: "Show feature match",
      detail: selectedFeatureTable ? tableLabel(selectedFeatureTable) : "Select table",
      href: "#producer-scenes",
      onSelect: () => {
        setScene("feature");
        setProducerActiveTab("scenes");
      },
    },
    {
      id: "script",
      label: "Open stream script",
      detail: "Feature notes and talking points",
      href: "#producer-script",
      keywords: ["commentator", "records"],
      onSelect: () => setProducerActiveTab("script"),
    },
    {
      id: "lower-third",
      label: "Build lower third",
      detail: "Name, subtitle, sponsor line",
      href: "#producer-lower-third",
      keywords: ["sponsor", "name"],
      onSelect: () => setProducerActiveTab("lower-third"),
    },
    {
      id: "runbook",
      label: "Open runbook",
      detail: "Segments and clip markers",
      href: "#producer-runbook",
      keywords: ["clip", "segment"],
      onSelect: () => setProducerActiveTab("runbook"),
    },
    {
      id: "commentator",
      label: "Commentator view",
      detail: "Open private read-only page",
      href: `/commentator/${tid}`,
    },
  ];
  const producerMobileActions: RoleCommandAction[] = [
    {
      id: "mobile-scenes",
      label: "Scenes",
      href: "#producer-scenes",
      onSelect: () => setProducerActiveTab("scenes"),
    },
    {
      id: "mobile-script",
      label: "Script",
      href: "#producer-script",
      onSelect: () => setProducerActiveTab("script"),
    },
    {
      id: "mobile-lower",
      label: "Lower",
      href: "#producer-lower-third",
      onSelect: () => setProducerActiveTab("lower-third"),
    },
    {
      id: "mobile-runbook",
      label: "Runbook",
      href: "#producer-runbook",
      onSelect: () => setProducerActiveTab("runbook"),
    },
  ];

  return (
    <div
      className={[
        "producer-page",
        `role-mode-${producerViewMode}`,
        `role-density-${producerDensity}`,
      ].join(" ")}
    >
      <header className="producer-header">
        <div>
          <span className="event-kicker">Producer Mode</span>
          <h1>{state?.name || `Tournament ${tid}`}</h1>
          <p>{error ?? (connected ? "Live control is connected." : "Connecting...")}</p>
        </div>
        <div className="producer-header-actions">
          <Link href={`/dashboard/${tid}`}>Dashboard</Link>
          <Link href={`/to/${tid}`}>TO</Link>
          <Link href={`/event/${tid}`} target="_blank">Player page</Link>
          <Link href={`/commentator/${tid}`}>Commentator</Link>
          <Link href={`/recap/${tid}`}>Recap</Link>
        </div>
      </header>

      <RoleExperienceShell
        role="Producer"
        title={
          state?.finished
            ? "Winner scene ready"
            : state?.roundStatus === "ended"
            ? "Standings scene recommended"
            : selectedFeatureTable?.status === "Active"
            ? "Feature script ready"
            : "Overlay sources ready"
        }
        subtitle={sceneSuggestions[0]?.label ?? "Choose scene, script, lower third or runbook."}
        statusCards={producerStatusCards}
        tabs={producerTabs}
        activeTab={producerActiveTab}
        viewMode={producerViewMode}
        density={producerDensity}
        onTabChange={setProducerActiveTab}
        onViewModeChange={setProducerViewMode}
        onDensityChange={setProducerDensity}
        actions={producerActions}
        alerts={producerAlerts}
        mobileActions={producerMobileActions}
        className="producer-role-shell"
      />

      <RoleWorkflowSection
        id="producer-scenes"
        tabId="scenes"
        activeTab={producerActiveTab}
        viewMode={producerViewMode}
      >
        <main className="producer-grid">
          <section className="card producer-control-panel">
            <h2>Scenes</h2>
            <div className="producer-scene-grid">
              {SCENES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={scene === item.id ? "active" : ""}
                  onClick={() => setScene(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="producer-field">
              <span>Feature table</span>
              <select
                value={featureTable}
                onChange={(event) => setFeatureTable(event.target.value)}
              >
                {tables.map((table) => (
                  <option key={String(table.table)} value={String(table.table)}>
                    {tableLabel(table)}
                  </option>
                ))}
              </select>
            </label>

            <div className="producer-url-box">
              <code>{url}</code>
              <button type="button" onClick={() => copy(url)}>Copy source</button>
            </div>

            <div className="producer-quick-links">
              <button type="button" onClick={() => copy(`${baseUrl}/overlay/${tid}/full`)}>
                Copy full overlay
              </button>
              <button type="button" onClick={() => copy(`${baseUrl}/venue/${tid}`)}>
                Copy venue
              </button>
              <button type="button" onClick={() => copy(`${baseUrl}/overlay/${tid}/ticker`)}>
                Copy ticker
              </button>
              <button type="button" onClick={() => copy(`${baseUrl}/commentator/${tid}`)}>
                Copy commentator
              </button>
            </div>

            <div className="producer-suggestions">
              <span>Scene suggestions</span>
              {sceneSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.scene}-${suggestion.label}`}
                  type="button"
                  onClick={() => setScene(suggestion.scene)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            {message && <p className="producer-message">{message}</p>}
          </section>

          <section className="card producer-preview-panel">
            <div className="producer-preview-header">
              <h2>Preview</h2>
              <Link href={path} target="_blank">Open</Link>
            </div>
            <iframe title="Overlay preview" src={path} />
          </section>
        </main>
      </RoleWorkflowSection>

      <RoleWorkflowSection
        id="producer-script"
        tabId="script"
        activeTab={producerActiveTab}
        viewMode={producerViewMode}
      >
        <section className="producer-script-grid producer-single-workflow">
          <div className="card producer-script-panel">
            <h2>Stream Script</h2>
            {selectedFeatureTable ? (
              <>
                <span>{tableLabel(selectedFeatureTable)}</span>
                <div className="producer-script-players">
                  {selectedFeatureTable.players.map((player) => (
                    <div key={player.id}>
                      <strong>{player.name}</strong>
                      <small>{playerRecordLabel(state, player.id, player.name)}</small>
                    </div>
                  ))}
                </div>
                <p>
                  Talking points: current round, player records, commander identities,
                  standings pressure and recent table pace.
                </p>
              </>
            ) : (
              <p>No feature table selected.</p>
            )}
          </div>
        </section>
      </RoleWorkflowSection>

      <RoleWorkflowSection
        id="producer-lower-third"
        tabId="lower-third"
        activeTab={producerActiveTab}
        viewMode={producerViewMode}
      >
        <section className="producer-script-grid producer-single-workflow">
          <div className="card producer-lower-third-builder">
            <h3>Lower Third Builder</h3>
            <input
              value={lowerTitle}
              onChange={(event) => setLowerTitle(event.target.value)}
              placeholder="Title"
            />
            <input
              value={lowerSubtitle}
              onChange={(event) => setLowerSubtitle(event.target.value)}
              placeholder="Subtitle"
            />
            <input
              value={sponsorLine}
              onChange={(event) => setSponsorLine(event.target.value)}
              placeholder="Sponsor line"
            />
            <button type="button" onClick={() => copy(lowerThirdUrl)}>
              Copy lower third
            </button>
          </div>
          <div className="card producer-control-panel">
            <label className="producer-field">
              <span>Venue announcement</span>
              <textarea
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                placeholder="Round 4 pairings are posted."
                rows={4}
              />
            </label>
            <button
              type="button"
              className="producer-primary"
              onClick={postAnnouncement}
              disabled={!announcement.trim()}
            >
              Post to venue
            </button>
            {message && <p className="producer-message">{message}</p>}
          </div>
        </section>
      </RoleWorkflowSection>

      <RoleWorkflowSection
        id="producer-runbook"
        tabId="runbook"
        activeTab={producerActiveTab}
        viewMode={producerViewMode}
      >
        <section className="producer-script-grid producer-single-workflow">
          <BroadcastRunbookPanel tid={tid} />
        </section>
      </RoleWorkflowSection>
    </div>
  );
}

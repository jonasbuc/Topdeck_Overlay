"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { TournamentOpsPanel } from "@/components/TournamentOpsPanel";
import {
  AnnouncementComposer,
  FloorMapEditor,
  JudgeQueuePanel,
  ShareQrPanel,
} from "@/components/EventOperationsPanel";
import {
  EmergencyToolsPanel,
  IncidentLogPanel,
  PlayerRequestsPanel,
  StaffRolesPanel,
} from "@/components/EventOpsAdvanced";
import { DiscordSetupWizard } from "@/components/DiscordSetupWizard";
import {
  RoleExperienceShell,
  RoleWorkflowSection,
  useRolePreferences,
  type RoleAlert,
  type RoleCommandAction,
  type RoleStatusCard,
  type RoleTone,
  type RoleWorkflowTab,
} from "@/components/RoleExperienceShell";

interface Props {
  params: { tid: string };
}

interface TOOpsHealth {
  state:
    | {
        exists: true;
        status: string;
        roundStatus: string;
        roundLabel: string;
        updatedAt: string;
      }
    | { exists: false; tid: string };
  discord: {
    link: {
      guildId: string;
      channelId: string;
      updatedAt: string;
    } | null;
  };
  eventOps: {
    round: {
      tableCount: number;
      completed: number;
      active: number;
      pending: number;
      completionRate: number | null;
    };
    announcements: {
      pinned: number;
      latest: { title: string; audience: string; createdAt: string } | null;
    };
    floorMap: {
      configured: boolean;
      zoneCount: number;
    };
    judgeQueue: {
      open: number;
      unresolved: number;
      urgent: number;
    };
    playerRequests: {
      open: number;
      unresolved: number;
      urgent: number;
    };
    staff: {
      total: number;
      active: number;
      onBreak: number;
      offline: number;
    };
    incidents: {
      total: number;
      open: number;
    };
  };
}

function percentLabel(value: number | null | undefined): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

function RoundLaunchChecklist({
  state,
  health,
}: {
  state: ReturnType<typeof useTournamentLive>["state"];
  health: TOOpsHealth | null;
}) {
  const items = [
    {
      label: "Pairings posted",
      done: (state?.tables.length ?? 0) > 0,
      detail: `${state?.tables.length ?? 0} tables`,
    },
    {
      label: "Clock started",
      done: state?.roundStatus === "active",
      detail: state?.roundStatus ?? "Waiting",
    },
    {
      label: "Discord linked",
      done: health?.discord.link != null,
      detail: health?.discord.link ? "Channel ready" : "Needs setup",
    },
    {
      label: "Venue ready",
      done: health?.eventOps.floorMap.configured === true,
      detail: `${health?.eventOps.floorMap.zoneCount ?? 0} zones`,
    },
    {
      label: "Staff active",
      done: (health?.eventOps.staff.active ?? 0) > 0,
      detail: `${health?.eventOps.staff.active ?? 0} active`,
    },
  ];

  return (
    <section className="card to-workflow-card">
      <div className="event-ops-card-header">
        <div>
          <h2>Round Launch Checklist</h2>
          <p>{items.filter((item) => item.done).length} of {items.length} ready</p>
        </div>
      </div>
      <div className="to-checklist">
        {items.map((item) => (
          <div key={item.label} className={item.done ? "done" : ""}>
            <span>{item.done ? "Ready" : "Needs attention"}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TOPage({ params }: Props) {
  const { tid } = params;
  const { state, connected, error } = useTournamentLive(tid);
  const {
    activeTab: toActiveTab,
    viewMode: toViewMode,
    density: toDensity,
    setActiveTab: setToActiveTab,
    setViewMode: setToViewMode,
    setDensity: setToDensity,
  } = useRolePreferences(`topdeck-live:${tid}:to-ux`, "launch");
  const [health, setHealth] = useState<TOOpsHealth | null>(null);
  const [autoOpenedToAlert, setAutoOpenedToAlert] = useState<string | null>(null);
  const completed = state?.tables.filter((table) => table.status === "Completed").length ?? 0;
  const active = state?.tables.filter((table) => table.status === "Active").length ?? 0;
  const pending = state?.tables.filter((table) => table.status === "Pending").length ?? 0;
  const urgentJudgeCalls = health?.eventOps.judgeQueue.urgent ?? 0;
  const urgentRequests = health?.eventOps.playerRequests.urgent ?? 0;
  const urgentTotal = urgentJudgeCalls + urgentRequests;
  const openIncidents = health?.eventOps.incidents.open ?? 0;
  const hasSetupGap =
    health != null &&
    (health.eventOps.announcements.pinned === 0 ||
      !health.eventOps.floorMap.configured ||
      health.discord.link == null);

  const loadHealth = useCallback(() => {
    fetch(`/api/tournaments/${tid}/ops`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TOOpsHealth | null) => setHealth(data))
      .catch(() => setHealth(null));
  }, [tid]);

  useEffect(() => {
    loadHealth();
    const id = window.setInterval(loadHealth, 8000);
    return () => window.clearInterval(id);
  }, [loadHealth]);

  useEffect(() => {
    const alertKey = urgentTotal > 0 ? `urgent-${urgentTotal}` : null;
    if (!alertKey || alertKey === autoOpenedToAlert) return;
    setToActiveTab(urgentJudgeCalls > 0 ? "floor" : "staff");
    setAutoOpenedToAlert(alertKey);
  }, [autoOpenedToAlert, setToActiveTab, urgentJudgeCalls, urgentTotal]);

  const nextAction =
    urgentTotal > 0
      ? "Handle urgent queue"
      : hasSetupGap
      ? "Finish event setup"
      : state?.roundStatus === "pending"
      ? "Launch round"
      : state?.roundStatus === "active"
      ? "Monitor pace"
      : "Review operations";
  const nextActionDetail =
    urgentTotal > 0
      ? `${urgentJudgeCalls} judge · ${urgentRequests} help`
      : hasSetupGap
      ? "Announcement, floor map or Discord needs attention"
      : `${completed} done · ${active} active · ${pending} pending`;
  const nextActionTone: RoleTone =
    urgentTotal > 0 ? "danger" : hasSetupGap ? "warning" : "good";
  const toTabs: RoleWorkflowTab[] = [
    {
      id: "launch",
      label: "Launch",
      detail: state?.roundStatus ?? "Status",
      tone: hasSetupGap ? "warning" : "good",
    },
    {
      id: "floor",
      label: "Floor",
      detail: `${active} active`,
      badge: urgentJudgeCalls || undefined,
      tone: urgentJudgeCalls > 0 ? "danger" : "neutral",
    },
    {
      id: "staff",
      label: "Staff",
      detail: `${health?.eventOps.staff.active ?? 0} active`,
      badge: urgentRequests || undefined,
      tone: urgentRequests > 0 ? "danger" : "neutral",
    },
    {
      id: "comms",
      label: "Comms",
      detail: health?.discord.link ? "Discord linked" : "Setup needed",
      tone: health?.discord.link ? "good" : "warning",
    },
    {
      id: "incidents",
      label: "Incidents",
      detail: `${openIncidents} open`,
      badge: openIncidents || undefined,
      tone: openIncidents > 0 ? "warning" : "neutral",
    },
  ];
  const toStatusCards: RoleStatusCard[] = [
    {
      id: "round",
      label: "Round",
      value: state?.roundLabel || "Waiting",
      detail: state?.roundStatus ?? "No live state",
      tone: state?.roundStatus === "active" ? "live" : "neutral",
      href: "#to-launch",
      onSelect: () => setToActiveTab("launch"),
    },
    {
      id: "urgent",
      label: "Urgent",
      value: urgentTotal > 0 ? `${urgentTotal} open` : "Clear",
      detail: `${urgentJudgeCalls} judge · ${urgentRequests} help`,
      tone: urgentTotal > 0 ? "danger" : "good",
      href: urgentJudgeCalls > 0 ? "#to-floor" : "#to-staff",
      onSelect: () => setToActiveTab(urgentJudgeCalls > 0 ? "floor" : "staff"),
    },
    {
      id: "next",
      label: "Next Action",
      value: nextAction,
      detail: nextActionDetail,
      tone: nextActionTone,
      href: hasSetupGap ? "#to-comms" : "#to-launch",
      onSelect: () => setToActiveTab(hasSetupGap ? "comms" : "launch"),
    },
    {
      id: "pace",
      label: "Round Pace",
      value: percentLabel(health?.eventOps.round.completionRate),
      detail: `${completed} done · ${pending} pending`,
      tone: pending > 0 && state?.roundStatus === "active" ? "warning" : "neutral",
      href: "#to-floor",
      onSelect: () => setToActiveTab("floor"),
    },
    {
      id: "staff",
      label: "Staff",
      value: `${health?.eventOps.staff.active ?? 0} active`,
      detail: `${health?.eventOps.staff.onBreak ?? 0} break · ${health?.eventOps.staff.offline ?? 0} offline`,
      tone: (health?.eventOps.staff.active ?? 0) > 0 ? "good" : "warning",
      href: "#to-staff",
      onSelect: () => setToActiveTab("staff"),
    },
  ];
  const toAlerts: RoleAlert[] = [
    ...(urgentJudgeCalls > 0
      ? [
          {
            id: "urgent-judge",
            label: `${urgentJudgeCalls} urgent judge call${urgentJudgeCalls === 1 ? "" : "s"}`,
            detail: "Open floor workflow",
            tone: "danger" as const,
            href: "#to-floor",
            onSelect: () => setToActiveTab("floor"),
          },
        ]
      : []),
    ...(urgentRequests > 0
      ? [
          {
            id: "urgent-help",
            label: `${urgentRequests} urgent help request${urgentRequests === 1 ? "" : "s"}`,
            detail: "Open staff workflow",
            tone: "danger" as const,
            href: "#to-staff",
            onSelect: () => setToActiveTab("staff"),
          },
        ]
      : []),
    ...(hasSetupGap
      ? [
          {
            id: "setup-gap",
            label: "Setup needs attention",
            detail: "Check Discord, announcement and venue map",
            tone: "warning" as const,
            href: "#to-comms",
            onSelect: () => setToActiveTab("comms"),
          },
        ]
      : []),
  ];
  const toActions: RoleCommandAction[] = [
    {
      id: "launch",
      label: "Round launch",
      detail: "Checklist and sync health",
      href: "#to-launch",
      keywords: ["checklist", "health", "sync"],
      onSelect: () => setToActiveTab("launch"),
    },
    {
      id: "floor",
      label: "Floor tools",
      detail: "Judge queue and floor map",
      href: "#to-floor",
      keywords: ["judge", "map", "tables"],
      onSelect: () => setToActiveTab("floor"),
    },
    {
      id: "staff",
      label: "Staff and help desk",
      detail: "Assignments and player requests",
      href: "#to-staff",
      keywords: ["roles", "water", "drop", "lost"],
      onSelect: () => setToActiveTab("staff"),
    },
    {
      id: "comms",
      label: "Announcements",
      detail: "Player page, venue and Discord",
      href: "#to-comms",
      keywords: ["discord", "message", "announcement"],
      onSelect: () => setToActiveTab("comms"),
    },
    {
      id: "incidents",
      label: "Incident log",
      detail: "Penalties, appeals and emergency tools",
      href: "#to-incidents",
      keywords: ["penalty", "appeal", "emergency"],
      onSelect: () => setToActiveTab("incidents"),
    },
    { id: "player", label: "Player page", detail: "Open public view", href: `/event/${tid}` },
    { id: "judge", label: "Judge page", detail: "Open judge console", href: `/judge/${tid}` },
    { id: "producer", label: "Producer page", detail: "Open stream controls", href: `/producer/${tid}` },
  ];
  const toMobileActions: RoleCommandAction[] = [
    {
      id: "mobile-launch",
      label: "Launch",
      href: "#to-launch",
      onSelect: () => setToActiveTab("launch"),
    },
    {
      id: "mobile-floor",
      label: "Floor",
      href: "#to-floor",
      tone: urgentJudgeCalls > 0 ? "danger" : "neutral",
      onSelect: () => setToActiveTab("floor"),
    },
    {
      id: "mobile-staff",
      label: "Staff",
      href: "#to-staff",
      tone: urgentRequests > 0 ? "danger" : "neutral",
      onSelect: () => setToActiveTab("staff"),
    },
    {
      id: "mobile-comms",
      label: "Comms",
      href: "#to-comms",
      onSelect: () => setToActiveTab("comms"),
    },
  ];

  return (
    <div
      className={[
        "to-page page-bg",
        `role-mode-${toViewMode}`,
        `role-density-${toDensity}`,
      ].join(" ")}
    >
      <header className="to-header">
        <div>
          <span className="event-kicker">TO Command Center</span>
          <h1>{state?.name || `Tournament ${tid}`}</h1>
          <p>{error ?? (connected ? "Live event operations are connected." : "Connecting...")}</p>
        </div>
        <div className="to-header-actions">
          <Link href={`/dashboard/${tid}`}>Dashboard</Link>
          <Link href={`/event/${tid}`} target="_blank">Player page</Link>
          <Link href={`/judge/${tid}`}>Judge</Link>
          <Link href={`/producer/${tid}`}>Producer</Link>
        </div>
      </header>

      <main className="to-shell">
        <RoleExperienceShell
          role="TO"
          title={nextAction}
          subtitle={nextActionDetail}
          statusCards={toStatusCards}
          tabs={toTabs}
          activeTab={toActiveTab}
          viewMode={toViewMode}
          density={toDensity}
          onTabChange={setToActiveTab}
          onViewModeChange={setToViewMode}
          onDensityChange={setToDensity}
          actions={toActions}
          alerts={toAlerts}
          mobileActions={toMobileActions}
        />

        <RoleWorkflowSection
          id="to-launch"
          tabId="launch"
          activeTab={toActiveTab}
          viewMode={toViewMode}
        >
          <div className="ops-dashboard-grid">
            <TournamentOpsPanel tid={tid} />
            <RoundLaunchChecklist state={state} health={health} />
          </div>
          <ShareQrPanel tid={tid} />
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="to-floor"
          tabId="floor"
          activeTab={toActiveTab}
          viewMode={toViewMode}
        >
          <div className="ops-dashboard-grid">
            <JudgeQueuePanel tid={tid} />
            <FloorMapEditor tid={tid} />
          </div>
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="to-staff"
          tabId="staff"
          activeTab={toActiveTab}
          viewMode={toViewMode}
        >
          <div className="ops-dashboard-grid">
            <StaffRolesPanel tid={tid} />
            <PlayerRequestsPanel tid={tid} />
          </div>
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="to-comms"
          tabId="comms"
          activeTab={toActiveTab}
          viewMode={toViewMode}
        >
          <div className="ops-dashboard-grid">
            <DiscordSetupWizard tid={tid} />
            <AnnouncementComposer tid={tid} />
          </div>
        </RoleWorkflowSection>

        <RoleWorkflowSection
          id="to-incidents"
          tabId="incidents"
          activeTab={toActiveTab}
          viewMode={toViewMode}
        >
          <div className="ops-dashboard-grid">
            <IncidentLogPanel tid={tid} />
            <EmergencyToolsPanel tid={tid} />
          </div>
        </RoleWorkflowSection>
      </main>
    </div>
  );
}

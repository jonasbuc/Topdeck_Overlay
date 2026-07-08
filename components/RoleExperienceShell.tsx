"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type RoleViewMode = "simple" | "advanced";
export type RoleDensity = "comfortable" | "compact";
export type RoleTone = "neutral" | "good" | "warning" | "danger" | "live";

export interface RoleStatusCard {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: RoleTone;
  href?: string;
  onSelect?: () => void;
}

export interface RoleWorkflowTab {
  id: string;
  label: string;
  detail?: string;
  badge?: string | number;
  tone?: RoleTone;
}

export interface RoleCommandAction {
  id: string;
  label: string;
  detail?: string;
  href?: string;
  keywords?: string[];
  tone?: RoleTone;
  onSelect?: () => void;
}

export interface RoleAlert {
  id: string;
  label: string;
  detail?: string;
  tone?: RoleTone;
  href?: string;
  onSelect?: () => void;
}

interface RolePreferences {
  activeTab: string;
  viewMode: RoleViewMode;
  density: RoleDensity;
  setActiveTab: (value: string) => void;
  setViewMode: (value: RoleViewMode) => void;
  setDensity: (value: RoleDensity) => void;
}

interface RoleExperienceShellProps {
  role: string;
  title: string;
  subtitle?: string;
  statusCards: RoleStatusCard[];
  tabs: RoleWorkflowTab[];
  activeTab: string;
  viewMode: RoleViewMode;
  density: RoleDensity;
  onTabChange: (value: string) => void;
  onViewModeChange: (value: RoleViewMode) => void;
  onDensityChange: (value: RoleDensity) => void;
  actions?: RoleCommandAction[];
  alerts?: RoleAlert[];
  mobileActions?: RoleCommandAction[];
  className?: string;
}

interface RoleWorkflowSectionProps {
  id?: string;
  tabId: string;
  activeTab: string;
  viewMode: RoleViewMode;
  className?: string;
  children: ReactNode;
}

const MAX_PALETTE_RESULTS = 8;

function actionMatches(action: RoleCommandAction, query: string): boolean {
  if (!query) return true;
  const haystack = [
    action.label,
    action.detail,
    action.href,
    ...(action.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function runRoleTarget(target: Pick<RoleCommandAction, "href" | "onSelect">): void {
  target.onSelect?.();
  if (!target.href) return;

  if (target.href.startsWith("#")) {
    const element = document.querySelector(target.href);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (element instanceof HTMLElement) element.focus({ preventScroll: true });
    history.replaceState(null, "", target.href);
    return;
  }

  window.location.href = target.href;
}

export function useRolePreferences(
  storageKey: string,
  defaultTab: string
): RolePreferences {
  const [activeTab, setActiveTabState] = useState(defaultTab);
  const [viewMode, setViewModeState] = useState<RoleViewMode>("simple");
  const [density, setDensityState] = useState<RoleDensity>("comfortable");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          activeTab: string;
          viewMode: RoleViewMode;
          density: RoleDensity;
        }>;
        if (saved.activeTab) setActiveTabState(saved.activeTab);
        if (saved.viewMode === "simple" || saved.viewMode === "advanced") {
          setViewModeState(saved.viewMode);
        }
        if (saved.density === "comfortable" || saved.density === "compact") {
          setDensityState(saved.density);
        }
      }
    } catch {
      // Preferences are a convenience only.
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ activeTab, viewMode, density })
      );
    } catch {
      // Ignore private browsing or storage quota failures.
    }
  }, [activeTab, density, ready, storageKey, viewMode]);

  return {
    activeTab,
    viewMode,
    density,
    setActiveTab: setActiveTabState,
    setViewMode: setViewModeState,
    setDensity: setDensityState,
  };
}

export function RoleExperienceShell({
  role,
  title,
  subtitle,
  statusCards,
  tabs,
  activeTab,
  viewMode,
  density,
  onTabChange,
  onViewModeChange,
  onDensityChange,
  actions = [],
  alerts = [],
  mobileActions = [],
  className,
}: RoleExperienceShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return actions
      .filter((action) => actionMatches(action, normalized))
      .slice(0, MAX_PALETTE_RESULTS);
  }, [actions, query]);

  const selectAction = (action: RoleCommandAction) => {
    runRoleTarget(action);
    setPaletteOpen(false);
    setQuery("");
  };

  return (
    <section
      className={[
        "role-experience-shell",
        `role-${role.toLowerCase()}`,
        `role-mode-${viewMode}`,
        `role-density-${density}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="role-shell-topline">
        <div>
          <span>{role}</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="role-shell-controls">
          <div className="role-toggle-group" aria-label={`${role} view mode`}>
            {(["simple", "advanced"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={viewMode === mode ? "active" : ""}
                onClick={() => onViewModeChange(mode)}
              >
                {mode === "simple" ? "Simple" : "Advanced"}
              </button>
            ))}
          </div>
          <div className="role-toggle-group" aria-label={`${role} density`}>
            {(["comfortable", "compact"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={density === mode ? "active" : ""}
                onClick={() => onDensityChange(mode)}
              >
                {mode === "comfortable" ? "Comfort" : "Compact"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="role-palette-trigger"
            onClick={() => setPaletteOpen(true)}
          >
            Search
            <kbd>⌘K</kbd>
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="role-alert-strip" aria-live="polite">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              className={`role-alert ${alert.tone ?? "warning"}`}
              onClick={() => runRoleTarget(alert)}
            >
              <strong>{alert.label}</strong>
              {alert.detail && <span>{alert.detail}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="role-status-grid">
        {statusCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`role-status-card ${card.tone ?? "neutral"}`}
            onClick={() => runRoleTarget(card)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.detail && <p>{card.detail}</p>}
          </button>
        ))}
      </div>

      <div className="role-workflow-tabs" role="tablist" aria-label={`${role} workflows`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${activeTab === tab.id ? "active" : ""} ${
              tab.tone ?? "neutral"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.badge != null && <strong>{tab.badge}</strong>}
            {tab.detail && <small>{tab.detail}</small>}
          </button>
        ))}
      </div>

      {paletteOpen && (
        <div
          className="role-palette-backdrop"
          role="presentation"
          onMouseDown={() => setPaletteOpen(false)}
        >
          <div
            className="role-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={`${role} command palette`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions"
              autoFocus
            />
            <div className="role-palette-list">
              {filteredActions.length === 0 && (
                <p className="empty-state">No matching actions.</p>
              )}
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.tone ?? "neutral"}
                  onClick={() => selectAction(action)}
                >
                  <strong>{action.label}</strong>
                  {action.detail && <span>{action.detail}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobileActions.length > 0 && (
        <nav className="role-mobile-actions" aria-label={`${role} quick actions`}>
          {mobileActions.slice(0, 4).map((action) => (
            <button
              key={action.id}
              type="button"
              className={action.tone ?? "neutral"}
              onClick={() => selectAction(action)}
            >
              {action.label}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}

export function RoleWorkflowSection({
  id,
  tabId,
  activeTab,
  viewMode,
  className,
  children,
}: RoleWorkflowSectionProps) {
  const hidden = viewMode === "simple" && activeTab !== tabId;
  return (
    <div
      id={id}
      tabIndex={-1}
      className={[
        "role-workflow-section",
        hidden ? "is-hidden" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

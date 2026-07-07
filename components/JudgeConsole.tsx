"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import type {
  JudgeCallCategory,
  JudgeCallDTO,
  JudgeCallPriority,
} from "@/lib/event-ops/types";
import {
  JUDGE_CALL_CATEGORIES,
  JUDGE_CALL_PRIORITIES,
} from "@/lib/event-ops/types";

interface Props {
  tid: string;
}

interface JudgeCallsResponse {
  calls: JudgeCallDTO[];
}

interface JudgeCardFace {
  name: string | null;
  printedName: string | null;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
}

interface JudgeCardRuling {
  source: string;
  publishedAt: string;
  comment: string;
}

interface JudgeCard {
  id: string;
  name: string;
  printedName: string | null;
  lang: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string | null;
  setName: string | null;
  collectorNumber: string | null;
  releasedAt: string | null;
  imageUrl: string | null;
  scryfallUri: string | null;
  gathererUri: string | null;
  printsSearchUri: string | null;
  legalities: Record<string, string>;
  faces: JudgeCardFace[];
  rulings: JudgeCardRuling[];
}

interface CardLookupResponse {
  card?: JudgeCard;
  error?: string;
  detail?: string;
}

const CATEGORY_LABELS: Record<JudgeCallCategory, string> = {
  rules: "Rules",
  deck_check: "Deck check",
  missing_player: "Missing player",
  result_issue: "Result issue",
  logistics: "Logistics",
  other: "Other",
};

const PRIORITY_LABELS: Record<JudgeCallPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_ORDER: Record<JudgeCallPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const RULE_TOPICS = [
  {
    title: "Priority and the stack",
    section: "CR 117, 405",
    tags: "priority stack responses casting activated abilities",
    detail: "Use for who can act next, when spells resolve, and shortcut disputes.",
  },
  {
    title: "Triggered abilities",
    section: "CR 603",
    tags: "triggered ability missed trigger whenever when at",
    detail: "Use for mandatory/optional triggers and timing of putting them on the stack.",
  },
  {
    title: "Replacement effects",
    section: "CR 614, 616",
    tags: "replacement prevention instead enters battlefield damage",
    detail: "Use for multiple replacement effects and affected-player/controller choice.",
  },
  {
    title: "Continuous effects and layers",
    section: "CR 613",
    tags: "layers power toughness type color ability timestamp dependency",
    detail: "Use for Humility-style questions, copy effects, counters and P/T modifiers.",
  },
  {
    title: "Copy effects",
    section: "CR 707",
    tags: "copy clone token mutate face down characteristics",
    detail: "Use for what is copied, copiable values and copy exceptions.",
  },
  {
    title: "Commander rules",
    section: "CR 903",
    tags: "commander color identity command zone damage tax partner",
    detail: "Use for color identity, commander tax, commander damage and zone changes.",
  },
  {
    title: "Tournament shortcuts",
    section: "MTR 4.2",
    tags: "shortcut communication priority combat loop tournament",
    detail: "Use for interpreting player communication and default shortcut assumptions.",
  },
  {
    title: "Player communication",
    section: "MTR 4.1",
    tags: "free derived private information communication notes",
    detail: "Use for what players must answer and what they may decline to clarify.",
  },
  {
    title: "Game rule violations",
    section: "IPG 2.5",
    tags: "grv illegal action missed state based action penalty fix",
    detail: "Use when a game action was illegal and you need the default remedy.",
  },
  {
    title: "Missed triggers",
    section: "IPG 2.1",
    tags: "missed trigger detrimental optional lapsing trigger",
    detail: "Use when a trigger was forgotten or noticed late in a tournament.",
  },
];

const LEGALITY_KEYS = ["commander", "legacy", "vintage", "modern", "standard", "pauper"];

function formatTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWait(value: string, doneAt?: string | null): string {
  const start = new Date(value).getTime();
  const end = doneAt ? new Date(doneAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "-";
  const minutes = Math.max(0, Math.round((end - start) / 60_000));
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function legalityClass(value: string | undefined): string {
  if (value === "legal") return "legal";
  if (value === "banned" || value === "not_legal") return "blocked";
  if (value === "restricted") return "restricted";
  return "unknown";
}

export function JudgeConsole({ tid }: Props) {
  const { state, connected, error } = useTournamentLive(tid);
  const [calls, setCalls] = useState<JudgeCallDTO[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [cardQuery, setCardQuery] = useState("");
  const [card, setCard] = useState<JudgeCard | null>(null);
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [rulesQuery, setRulesQuery] = useState("");

  const loadCalls = useCallback(() => {
    fetch(`/api/tournaments/${tid}/judge-calls${includeResolved ? "?all=true" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: JudgeCallsResponse | null) => setCalls(data?.calls ?? []))
      .catch(() => setCalls([]));
  }, [includeResolved, tid]);

  useEffect(() => {
    loadCalls();
    const id = window.setInterval(loadCalls, 5000);
    return () => window.clearInterval(id);
  }, [loadCalls]);

  const patchCall = async (
    call: JudgeCallDTO,
    patch: Partial<
      Pick<
        JudgeCallDTO,
        "status" | "priority" | "category" | "assignedTo" | "internalNote"
      >
    >
  ) => {
    await fetch(`/api/tournaments/${tid}/judge-calls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: call.id, ...patch }),
    });
    loadCalls();
  };

  const sortedCalls = useMemo(
    () =>
      calls.slice().sort((a, b) => {
        if (a.status === "resolved" && b.status !== "resolved") return 1;
        if (a.status !== "resolved" && b.status === "resolved") return -1;
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [calls]
  );

  const unresolved = calls.filter((call) => call.status !== "resolved");
  const urgent = unresolved.filter((call) => call.priority === "urgent");

  const filteredRules = useMemo(() => {
    const needle = rulesQuery.trim().toLowerCase();
    if (!needle) return RULE_TOPICS;
    return RULE_TOPICS.filter((topic) =>
      `${topic.title} ${topic.section} ${topic.tags} ${topic.detail}`
        .toLowerCase()
        .includes(needle)
    );
  }, [rulesQuery]);

  const lookupCard = async (event?: FormEvent, overrideQuery?: string) => {
    event?.preventDefault();
    const query = (overrideQuery ?? cardQuery).trim();
    if (!query) return;
    setCardQuery(query);
    setCardLoading(true);
    setCardMessage(null);
    try {
      const res = await fetch(`/api/judge/cards?query=${encodeURIComponent(query)}`);
      const payload = (await res.json()) as CardLookupResponse;
      if (!res.ok || !payload.card) {
        throw new Error(payload.detail ?? "Card not found.");
      }
      setCard(payload.card);
    } catch (lookupError) {
      setCard(null);
      setCardMessage(
        lookupError instanceof Error ? lookupError.message : "Card lookup failed."
      );
    } finally {
      setCardLoading(false);
    }
  };

  const oracleBlocks =
    card && card.faces.length > 0
      ? card.faces
      : card
      ? [
          {
            name: card.name,
            printedName: card.printedName,
            manaCost: card.manaCost,
            typeLine: card.typeLine,
            oracleText: card.oracleText,
          },
        ]
      : [];

  return (
    <div className="judge-page">
      <header className="judge-header">
        <div>
          <span className="judge-kicker">Judge Console</span>
          <h1>{state?.name || `Tournament ${tid}`}</h1>
          <p>
            {state?.roundLabel || "No round"} · {state?.roundStatus ?? "loading"} ·{" "}
            {unresolved.length} active calls
          </p>
        </div>
        <nav>
          <span className="status-bar">
            <span className={`status-dot ${error ? "error" : connected ? "connected" : ""}`} />
            <span>{error ?? (connected ? "Live" : "Connecting...")}</span>
          </span>
          <Link href={`/dashboard/${tid}`}>Dashboard</Link>
          <Link href={`/event/${tid}`} target="_blank">Player page</Link>
          <Link href={`/producer/${tid}`}>Producer</Link>
        </nav>
      </header>

      <main className="judge-grid">
        <section className="card judge-panel judge-queue-panel">
          <div className="judge-panel-header">
            <div>
              <span className="judge-kicker">Live Calls</span>
              <h2>{unresolved.length} active</h2>
              <p>{urgent.length} urgent · {calls.length} visible</p>
            </div>
            <label className="event-ops-check">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(event) => setIncludeResolved(event.target.checked)}
              />
              <span>Resolved</span>
            </label>
          </div>

          <div className="judge-call-stack">
            {sortedCalls.length === 0 && (
              <p className="empty-state">No judge calls right now.</p>
            )}
            {sortedCalls.map((call) => (
              <article
                key={call.id}
                className={`judge-call-row ${call.status} priority-${call.priority}`}
              >
                <div>
                  <span>
                    {call.tableNumber ? `Table ${call.tableNumber}` : "No table"} ·{" "}
                    {formatTime(call.createdAt)} · waiting{" "}
                    {formatWait(call.createdAt, call.resolvedAt)}
                  </span>
                  <strong>{call.playerName || "Player"}</strong>
                  <div className="judge-meta-row">
                    <span className={`judge-priority ${call.priority}`}>
                      {PRIORITY_LABELS[call.priority]}
                    </span>
                    <span>{CATEGORY_LABELS[call.category]}</span>
                    <span>{call.assignedTo ? `Judge: ${call.assignedTo}` : "Unassigned"}</span>
                  </div>
                  {call.message && <p>{call.message}</p>}
                  {call.internalNote && (
                    <p className="judge-internal-note">{call.internalNote}</p>
                  )}
                  <div className="judge-control-grid">
                    <label>
                      <span>Priority</span>
                      <select
                        value={call.priority}
                        onChange={(event) =>
                          patchCall(call, {
                            priority: event.target.value as JudgeCallPriority,
                          })
                        }
                      >
                        {JUDGE_CALL_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {PRIORITY_LABELS[priority]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Category</span>
                      <select
                        value={call.category}
                        onChange={(event) =>
                          patchCall(call, {
                            category: event.target.value as JudgeCallCategory,
                          })
                        }
                      >
                        {JUDGE_CALL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Assigned</span>
                      <input
                        defaultValue={call.assignedTo ?? ""}
                        placeholder="Judge name"
                        onBlur={(event) =>
                          patchCall(call, { assignedTo: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Internal note</span>
                      <input
                        defaultValue={call.internalNote ?? ""}
                        placeholder="Private note"
                        onBlur={(event) =>
                          patchCall(call, { internalNote: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="event-ops-row-actions">
                  {call.status === "open" && (
                    <button
                      type="button"
                      onClick={() => patchCall(call, { status: "acknowledged" })}
                    >
                      Ack
                    </button>
                  )}
                  {call.status !== "resolved" && (
                    <button
                      type="button"
                      onClick={() => patchCall(call, { status: "resolved" })}
                    >
                      Resolve
                    </button>
                  )}
                  {call.status === "resolved" && (
                    <button
                      type="button"
                      onClick={() => patchCall(call, { status: "open" })}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card judge-panel judge-card-panel">
          <div className="judge-panel-header">
            <div>
              <span className="judge-kicker">Card Reference</span>
              <h2>Oracle and rulings</h2>
              <p>Foreign prints, legalities and official rulings via Scryfall.</p>
            </div>
          </div>

          <form className="judge-search-row" onSubmit={lookupCard}>
            <input
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              placeholder="Card name or foreign printed name"
              autoComplete="off"
            />
            <button type="submit" disabled={cardLoading || !cardQuery.trim()}>
              {cardLoading ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="judge-sample-row">
            {["Rhystic Study", "Dockside Extortionist", "Orcish Bowmasters"].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  lookupCard(undefined, name);
                }}
              >
                {name}
              </button>
            ))}
          </div>

          {cardMessage && <p className="judge-error">{cardMessage}</p>}

          {card && (
            <div className="judge-card-result">
              {card.imageUrl && (
                <div className="judge-card-image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.imageUrl} alt={card.name} />
                </div>
              )}

              <div className="judge-card-details">
                <span className="judge-kicker">
                  {card.lang.toUpperCase()} · {card.rarity ?? "unknown rarity"}
                </span>
                <h3>{card.printedName ?? card.name}</h3>
                {card.printedName && <p className="judge-card-english">{card.name}</p>}
                <p className="judge-card-type">{card.typeLine}</p>
                <div className="judge-card-meta">
                  {card.manaCost && <span>{card.manaCost}</span>}
                  {card.power && card.toughness && (
                    <span>{card.power}/{card.toughness}</span>
                  )}
                  {card.loyalty && <span>Loyalty {card.loyalty}</span>}
                  {card.setName && <span>{card.setName}</span>}
                  {card.collectorNumber && <span>#{card.collectorNumber}</span>}
                </div>

                <div className="judge-oracle-list">
                  {oracleBlocks.map((face, index) => (
                    <article key={`${face.name}-${index}`} className="judge-oracle-face">
                      {face.name && <strong>{face.printedName ?? face.name}</strong>}
                      {face.typeLine && <span>{face.typeLine}</span>}
                      <p>{face.oracleText ?? "No oracle text."}</p>
                    </article>
                  ))}
                </div>

                <div className="judge-legality-grid">
                  {LEGALITY_KEYS.map((key) => (
                    <span key={key} className={legalityClass(card.legalities[key])}>
                      {key}: {card.legalities[key]?.replace("_", " ") ?? "unknown"}
                    </span>
                  ))}
                </div>

                <div className="judge-resource-links compact">
                  {card.scryfallUri && (
                    <a href={card.scryfallUri} target="_blank" rel="noreferrer">
                      Scryfall
                    </a>
                  )}
                  {card.gathererUri && (
                    <a href={card.gathererUri} target="_blank" rel="noreferrer">
                      Gatherer
                    </a>
                  )}
                  {card.printsSearchUri && (
                    <a href={card.printsSearchUri} target="_blank" rel="noreferrer">
                      Prints
                    </a>
                  )}
                </div>
              </div>

              <div className="judge-rulings-list">
                <h3>Rulings</h3>
                {card.rulings.length === 0 && (
                  <p className="empty-state">No published rulings for this card.</p>
                )}
                {card.rulings.slice(0, 8).map((ruling) => (
                  <article key={`${ruling.publishedAt}-${ruling.comment}`}>
                    <span>
                      {ruling.source} · {ruling.publishedAt}
                    </span>
                    <p>{ruling.comment}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card judge-panel judge-rules-panel">
          <div className="judge-panel-header">
            <div>
              <span className="judge-kicker">Rules Toolkit</span>
              <h2>Fast references</h2>
              <p>Common table calls plus official policy documents.</p>
            </div>
          </div>

          <input
            className="judge-rule-search"
            value={rulesQuery}
            onChange={(event) => setRulesQuery(event.target.value)}
            placeholder="Filter: layers, trigger, commander, shortcut..."
          />

          <div className="judge-rule-topic-grid">
            {filteredRules.map((topic) => (
              <article key={topic.title} className="judge-rule-topic">
                <span>{topic.section}</span>
                <strong>{topic.title}</strong>
                <p>{topic.detail}</p>
              </article>
            ))}
          </div>

          <div className="judge-resource-links">
            <a href="https://magic.wizards.com/en/rules" target="_blank" rel="noreferrer">
              Comprehensive Rules
            </a>
            <a
              href="https://wpn.wizards.com/en/rules-documents"
              target="_blank"
              rel="noreferrer"
            >
              MTR / IPG
            </a>
            <a href="https://gatherer.wizards.com" target="_blank" rel="noreferrer">
              Gatherer
            </a>
            <a href="https://scryfall.com/advanced" target="_blank" rel="noreferrer">
              Scryfall Advanced
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

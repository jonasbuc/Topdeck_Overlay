"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTournamentLive } from "@/hooks/useTournamentLive";

interface Props {
  params: { tid: string };
}

interface CardLookupResult {
  card: {
    name: string;
    manaCost: string | null;
    typeLine: string | null;
    oracleText: string | null;
    scryfallUri: string | null;
    legalities: Record<string, string>;
    rulings: Array<{ comment: string; publishedAt: string }>;
  };
}

export default function CommentatorPage({ params }: Props) {
  const { tid } = params;
  const { state, connected, error } = useTournamentLive(tid);
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<CardLookupResult["card"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const featureTable = useMemo(() => {
    const tables = state?.tables.filter((table) => table.table !== "Byes") ?? [];
    return (
      tables.find((table) => table.status === "Active") ??
      tables.find((table) => table.status === "Pending") ??
      tables[0] ??
      null
    );
  }, [state?.tables]);

  const lookup = async () => {
    if (!query.trim()) return;
    setMessage("Searching...");
    try {
      const res = await fetch(`/api/judge/cards?query=${encodeURIComponent(query)}`);
      const payload = (await res.json()) as CardLookupResult | { detail?: string };
      if (!res.ok || !("card" in payload)) throw new Error("Card not found");
      setCard(payload.card);
      setMessage(null);
    } catch {
      setCard(null);
      setMessage("Card lookup failed.");
    }
  };

  return (
    <div className="commentator-page page-bg">
      <header className="commentator-header">
        <div>
          <span className="event-kicker">Commentator View</span>
          <h1>{state?.name || `Tournament ${tid}`}</h1>
          <p>{error ?? (connected ? "Live read-only data connected." : "Connecting...")}</p>
        </div>
        <div className="producer-header-actions">
          <Link href={`/producer/${tid}`}>Producer</Link>
          <Link href={`/analytics/${tid}`}>Analytics</Link>
          <Link href={`/judge/${tid}`}>Judge tools</Link>
        </div>
      </header>

      <main className="commentator-grid">
        <section className="card commentator-feature-card">
          <h2>Feature Table</h2>
          {featureTable ? (
            <>
              <span>
                {featureTable.table === "Byes" ? "Byes" : `Table ${featureTable.table}`} ·{" "}
                {featureTable.status}
              </span>
              <div className="commentator-player-list">
                {featureTable.players.map((player) => {
                  const standing = state?.standings.find(
                    (entry) => entry.id === player.id || entry.name === player.name
                  );
                  return (
                    <div key={player.id}>
                      <strong>{player.name}</strong>
                      <small>
                        {standing ? `#${standing.standing} · ${standing.points} pts` : "No standing"}
                      </small>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p>No feature table available.</p>
          )}
        </section>

        <section className="card commentator-standings-card">
          <h2>Live Standings</h2>
          <div className="commentator-standings-list">
            {(state?.standings ?? []).slice(0, 12).map((standing) => (
              <div key={standing.id}>
                <span>#{standing.standing}</span>
                <strong>{standing.name}</strong>
                <small>{standing.points} pts</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card commentator-card-lookup">
          <h2>Card Lookup</h2>
          <div className="event-card-search-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Card name"
            />
            <button type="button" onClick={lookup} disabled={!query.trim()}>
              Lookup
            </button>
          </div>
          {message && <p className="text-muted">{message}</p>}
          {card && (
            <div className="commentator-card-result">
              <span>{card.manaCost ?? "No mana cost"}</span>
              <strong>{card.name}</strong>
              <p>{card.typeLine}</p>
              <p>{card.oracleText}</p>
              <small>Commander: {card.legalities.commander ?? "unknown"}</small>
              {card.scryfallUri && (
                <a href={card.scryfallUri} target="_blank" rel="noreferrer">
                  Oracle
                </a>
              )}
            </div>
          )}
        </section>

        <section className="card commentator-results-card">
          <h2>Recent Results</h2>
          <div className="commentator-results-list">
            {(state?.matchResults ?? []).slice(0, 10).map((result) => (
              <div key={`${result.stage}-${result.round}-${result.reportedAt}`}>
                <span>Table {result.tableNumber}</span>
                <strong>{result.table.winner ?? result.result}</strong>
                <small>{new Date(result.reportedAt).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

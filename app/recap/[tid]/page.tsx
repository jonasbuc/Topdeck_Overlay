import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentState } from "@/lib/topdeck/tournament-state";

interface Props {
  params: { tid: string };
}

function formatRound(label: string, round: number): string {
  if (label) return /^\d+$/.test(label) ? `Round ${label}` : label;
  return round > 0 ? `Round ${round}` : "Tournament";
}

export default async function RecapPage({ params }: Props) {
  const state = await getTournamentState(params.tid);
  if (!state) notFound();

  const winner = state.winner?.name ?? state.standings[0]?.name ?? "Winner pending";
  const topStandings = state.standings.slice(0, 16);

  return (
    <main className="recap-page">
      <header className="recap-hero">
        <div>
          <span className="event-kicker">Event Recap</span>
          <h1>{state.name || `Tournament ${params.tid}`}</h1>
          <p>
            {state.format || state.game || "TopDeck Live"} ·{" "}
            {state.participantCount ?? state.players.length} players ·{" "}
            {state.finished ? "Finished" : state.status}
          </p>
        </div>
        <nav>
          <Link href={`/event/${params.tid}`}>Player page</Link>
          <Link href={`/analytics/${params.tid}`}>Analytics</Link>
        </nav>
      </header>

      <section className="recap-winner-card">
        <span>Champion</span>
        <strong>{winner}</strong>
        <p>{formatRound(state.roundLabel, state.currentRound)}</p>
      </section>

      <section className="recap-grid">
        <article className="card recap-card">
          <h2>Top Standings</h2>
          <div className="recap-standings">
            {topStandings.map((standing) => (
              <div key={standing.id}>
                <span>#{standing.standing}</span>
                <strong>{standing.name}</strong>
                <small>{standing.points} pts</small>
              </div>
            ))}
          </div>
        </article>

        <article className="card recap-card">
          <h2>Round History</h2>
          <div className="recap-rounds">
            {(state.roundHistory ?? []).map((round) => (
              <div key={`${round.stage}-${round.round}`}>
                <strong>{formatRound(round.roundLabel, round.round)}</strong>
                <span>{round.tables.length} tables</span>
              </div>
            ))}
            {(state.roundHistory ?? []).length === 0 && (
              <p className="empty-state">Round history will appear after completed rounds.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}

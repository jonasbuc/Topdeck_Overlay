"use client";

import Link from "next/link";
import { useTournamentLive } from "@/hooks/useTournamentLive";
import { TournamentOpsPanel } from "@/components/TournamentOpsPanel";
import { EventOperationsPanel } from "@/components/EventOperationsPanel";
import { DiscordSetupWizard } from "@/components/DiscordSetupWizard";

interface Props {
  params: { tid: string };
}

export default function TOPage({ params }: Props) {
  const { tid } = params;
  const { state, connected, error } = useTournamentLive(tid);
  const completed = state?.tables.filter((table) => table.status === "Completed").length ?? 0;
  const active = state?.tables.filter((table) => table.status === "Active").length ?? 0;
  const pending = state?.tables.filter((table) => table.status === "Pending").length ?? 0;

  return (
    <div className="to-page page-bg">
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
        <section className="to-snapshot-grid">
          <div>
            <span>Round</span>
            <strong>{state?.roundLabel || "Waiting"}</strong>
            <p>{state?.roundStatus ?? "No live state"}</p>
          </div>
          <div>
            <span>Tables</span>
            <strong>{state?.tables.length ?? 0}</strong>
            <p>{completed} done · {active} active · {pending} pending</p>
          </div>
          <div>
            <span>Players</span>
            <strong>{state?.participantCount ?? state?.players.length ?? "-"}</strong>
            <p>{state?.droppedPlayers.length ?? 0} dropped</p>
          </div>
          <div>
            <span>Status</span>
            <strong>{state?.finished ? "Finished" : state?.status ?? "Loading"}</strong>
            <p>{state?.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleTimeString()}` : "-"}</p>
          </div>
        </section>

        <div className="ops-dashboard-grid">
          <TournamentOpsPanel tid={tid} />
          <DiscordSetupWizard tid={tid} />
        </div>

        <EventOperationsPanel tid={tid} />
      </main>
    </div>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2 text-accent">
          🃏 TopDeck Live
        </h1>
        <p className="text-lg text-muted">
          Webhook-powered live tournament coverage for cEDH
        </p>
      </div>

      <div className="grid gap-4 text-sm max-w-md w-full">
        <Link href="/tournaments" className="card card-link">
          <h2 className="font-semibold mb-1 text-accent">
            My Tournaments
          </h2>
          <code className="text-xs text-muted">
            /tournaments
          </code>
        </Link>

        <div className="card">
          <h2 className="font-semibold mb-1 text-accent">
            Webhook endpoint
          </h2>
          <code className="text-xs text-muted">
            POST /api/webhooks/topdeck
          </code>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1 text-accent">
            Live dashboard
          </h2>
          <code className="text-xs text-muted">
            /dashboard/[tid]
          </code>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1 text-accent">
            Analytics
          </h2>
          <code className="text-xs text-muted">
            /analytics/[tid]
          </code>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1 text-accent">
            OBS overlays
          </h2>
          <code className="text-xs text-muted">
            /overlay/[tid]/full · /clock · /pairings · /standings · /lower-third · /feature/[n] · /winner · /ticker
          </code>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1 text-accent">
            Venue display
          </h2>
          <code className="text-xs text-muted">
            /venue/[tid]
          </code>
        </div>
      </div>
    </main>
  );
}
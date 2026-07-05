# 🃏 TopDeck Live

A production-ready webhook-based **live tournament coverage tool** for cEDH Magic: The Gathering events — built for real tournament coverage with OBS overlays, a live dashboard, round history, and post-tournament analytics.

Receives signed [TopDeck.gg](https://topdeck.gg) webhooks and turns them into live tournament overlays, standings screens, round clocks, and coverage dashboards — in real-time.

---

## Features

- **Secure webhook endpoint** — HMAC-SHA256 signature verification + timestamp replay protection
- **Deduplication** by `event.id` — handles TopDeck's at-least-once delivery
- **Derived tournament state** maintained per `tid` in SQLite via Prisma
- **Server-Sent Events** — real-time browser updates without a WebSocket server
- **Live dashboard** at `/dashboard/[tid]` — round clock, pairings, results feed, standings, roster, round history browser
- **OBS browser-source overlays** — transparent background, 1920×1080 optimized
- **Post-tournament analytics** at `/analytics/[tid]` — podium, win rates, round-by-round performance matrix
- **Round history viewer** — browse pairings and standings from every completed round
- **Winner screen** — full-screen champion celebration with link to analytics
- **Overtime clock** — counts up as `+MM:SS` once regulation time expires

---

## Available overlays

All overlays are transparent-background browser sources designed for OBS at 1920×1080.

| Path | Description |
|------|-------------|
| `/overlay/[tid]/full` | Full combined overlay — clock + lower third + ticker |
| `/overlay/[tid]/clock` | Round clock only (counts down, then `+MM:SS` overtime) |
| `/overlay/[tid]/pairings` | Full pairings table for the current round |
| `/overlay/[tid]/feature/[n]` | Feature match spotlight for table `n` |
| `/overlay/[tid]/lower-third` | Lower-third name strip (feature match players) |
| `/overlay/[tid]/standings` | Live standings leaderboard |
| `/overlay/[tid]/ticker` | Scrolling ticker with current round results |
| `/overlay/[tid]/winner` | Full-screen winner celebration (auto-shows on `tournament.finished`) |

---

## Project structure

```
topdeck-live/
├── app/
│   ├── api/
│   │   ├── webhooks/topdeck/route.ts   ← Signed webhook receiver
│   │   ├── live/[tid]/route.ts         ← SSE stream per tournament
│   │   └── tournaments/[tid]/route.ts  ← REST state snapshot
│   ├── dashboard/[tid]/page.tsx        ← Live coverage dashboard
│   ├── overlay/[tid]/                  ← OBS overlay pages
│   ├── analytics/[tid]/page.tsx        ← Post-tournament stats
│   └── venue/[tid]/page.tsx            ← Venue display (standings + clock)
├── components/
│   ├── RoundClock.tsx
│   ├── PairingsTable.tsx
│   ├── MatchResultsFeed.tsx
│   ├── LiveStandings.tsx
│   ├── PlayerRoster.tsx
│   ├── DroppedPlayers.tsx
│   ├── WinnerScreen.tsx
│   └── RoundHistoryViewer.tsx
├── hooks/
│   └── useTournamentLive.ts            ← SSE hook
├── lib/
│   ├── env.ts
│   ├── prisma.ts
│   └── topdeck/
│       ├── types.ts
│       ├── verify-signature.ts
│       ├── event-store.ts
│       ├── event-processor.ts
│       ├── tournament-state.ts
│       ├── analytics.ts
│       └── sse-publisher.ts
├── prisma/schema.prisma
├── vercel.json
└── __tests__/
```

---

## Deploying to Vercel (production — recommended)

### 1. Push to GitHub

```bash
git add .
git commit -m "initial deploy"
git push
```

### 2. Import the project on Vercel

Go to [vercel.com/new](https://vercel.com/new), import your GitHub repo.  
Vercel auto-detects Next.js. Leave all defaults.

### 3. Set environment variables

In the Vercel dashboard → **Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `TOPDECK_WEBHOOK_SECRET` | `whsec_...` from TopDeck portal (see below) |
| `TOPDECK_API_KEY` | Your TopDeck API key (optional — for enrichment) |
| `DATABASE_URL` | Your production database URL (see note below) |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |

> ⚠️ **SQLite does not work on Vercel** (serverless, no persistent filesystem).  
> Use one of these zero-config alternatives:
>
> - **[Turso](https://turso.tech)** (recommended — free tier, libSQL, works with Prisma):  
>   `DATABASE_URL="libsql://your-db.turso.io?authToken=your-token"`  
>   Add `@prisma/adapter-libsql` and update `schema.prisma` provider to `"sqlite"` with the libsql adapter.
>
> - **[Neon Postgres](https://neon.tech)** (free tier):  
>   `DATABASE_URL="postgresql://..."` — change `schema.prisma` provider to `"postgresql"`.
>
> - **[Vercel Postgres](https://vercel.com/storage/postgres)**:  
>   Set up in the Vercel dashboard — `DATABASE_URL` is injected automatically.
>
> For local dev you can keep `DATABASE_URL="file:./prisma/dev.db"` in `.env`.

### 4. Deploy

Click **Deploy** on Vercel. The `vercel.json` in the repo runs `prisma generate && next build` automatically.

Your app is live at `https://your-app.vercel.app`.

---

## Setting up the TopDeck webhook

### Get your webhook endpoint URL

```
https://your-app.vercel.app/api/webhooks/topdeck
```

(Replace `your-app.vercel.app` with your actual Vercel domain.)

### Register it in the TopDeck developer portal

1. Go to **[topdeck.gg/developers](https://topdeck.gg/developers)** (or TopDeck → Settings → Developer)
2. Click **Add Endpoint**
3. Paste in the URL above
4. Select all event types: `ping`, `tournament.*`, `round.*`, `match.*`, `player.*`
5. Click **Save**
6. TopDeck displays the **endpoint secret** (`whsec_...`) — copy it
7. Set `TOPDECK_WEBHOOK_SECRET` in your Vercel environment variables (or `.env` for local dev)
8. Redeploy / restart the server

### Test the connection

Click **Send test ping** in the portal. In Vercel function logs (or local terminal) you'll see:

```
[webhook] ping received from TopDeck — endpoint is healthy
```

---

## Finding your tournament TID

The TID appears in the TopDeck URL when you open a tournament:

```
https://topdeck.gg/tournaments/tid_abc123def456
                                ^^^^^^^^^^^^^^^^
                                   your TID
```

It also arrives in the first webhook payload as `event.tid`.

---

## OBS setup

### Adding an overlay

1. In OBS, add a **Browser Source**
2. Set the URL to one of the overlay paths, e.g.:  
   `https://your-app.vercel.app/overlay/tid_abc123/full`
3. Set **Width** `1920`, **Height** `1080`
4. Under **Custom CSS** paste:
   ```css
   body { background: transparent !important; overflow: hidden; }
   ```
5. Enable **Shutdown source when not visible** ✅
6. Enable **Refresh browser when scene becomes active** ✅
7. Click **OK**

The overlay updates live as webhooks arrive — no manual refresh needed.

### Recommended OBS scene layout

| Scene | Browser source URL |
|-------|-------------------|
| Coverage main | `/overlay/[tid]/full` |
| Feature match | `/overlay/[tid]/feature/1` + `/overlay/[tid]/lower-third` |
| Standings break | `/overlay/[tid]/standings` |
| Winner reveal | `/overlay/[tid]/winner` |
| Venue display (TV) | `/venue/[tid]` — standings + clock for room screens |

### Using the dashboard

Open `/dashboard/[tid]` in a browser on your coverage laptop.  
It shows the round clock, live pairings, match results feed, standings, player roster, and round history — all updating live.

---

## Local development & testing

### 1. Install & set up

```bash
git clone <your-repo>
cd topdeck-live
npm install
cp .env.example .env   # then edit .env
npx prisma db push
npm run dev
```

### 2. Expose localhost for webhook testing

TopDeck needs a public HTTPS URL to send webhooks. Use [localtunnel](https://github.com/localtunnel/localtunnel) (no account needed):

```bash
npx localtunnel --port 3000
# → your url is: https://some-words.loca.lt
```

Use `https://some-words.loca.lt/api/webhooks/topdeck` as your endpoint URL in the TopDeck portal.

> The tunnel URL changes every time you restart it — update the portal endpoint accordingly.

### 3. Send test events locally

```bash
npm run send-test-event ping
npm run send-test-event round.published   tid_test_001
npm run send-test-event round.started     tid_test_001
npm run send-test-event match.result_reported tid_test_001
npm run send-test-event round.ended       tid_test_001
npm run send-test-event tournament.finished tid_test_001
```

Then open **http://localhost:3000/dashboard/tid_test_001**

---

## Running tests

```bash
npm test            # run all tests
npm run test:watch  # watch mode
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/topdeck` | Receives signed TopDeck events |
| `GET`  | `/api/live/[tid]` | SSE stream — real-time state updates |
| `GET`  | `/api/tournaments/[tid]` | REST snapshot of current state |

### Webhook security

- Signature header: `X-TopDeck-Signature: t=<unix>,v1=<hex-hmac-sha256>`
- HMAC message: `` `${t}.${rawBody}` ``
- Constant-time comparison via `crypto.timingSafeEqual`
- Timestamp tolerance: **5 minutes**
- Returns `401` for invalid signatures, `200` for valid ones

---

## Supported webhook events

| Event | Effect |
|-------|--------|
| `ping` | Health check — logs and returns 200 |
| `tournament.checkin_started` | Sets metadata + check-in flag |
| `round.published` | Updates pairings; infers player roster from tables |
| `round.started` | Starts the round clock |
| `match.result_reported` | Updates pairing result + results feed |
| `round.ended` | Updates standings; snapshots round into history |
| `tournament.finished` | Sets winner, final standings, finished flag |
| `player.registered` | Adds player to roster |
| `player.dropped` | Marks player as dropped |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | CSS (custom design system) |
| Database | SQLite via Prisma 5 (local) / Turso or Postgres (production) |
| Realtime | Server-Sent Events |
| Testing | Vitest |

---

## Production notes

> **Multi-instance / horizontal scaling**: The SSE publisher uses an in-process subscriber map. If you run multiple server instances, replace `lib/topdeck/sse-publisher.ts` with a Redis pub/sub backend so all instances share the same event stream. On Vercel (single serverless function per request), this is not an issue.

> **Database in production**: SQLite (`file:./dev.db`) only works in single-process Node servers. For Vercel or any serverless host, use Turso (libSQL) or a Postgres provider — both work with Prisma and require only a `DATABASE_URL` change and a schema provider update.

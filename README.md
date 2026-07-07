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
- **Player companion page** at `/event/[tid]` — mobile-first live round view, player finder, pairings, standings, venue, and parking
- **Tournament ops panel** — dashboard health checks for webhooks, TopDeck sync, Discord setup, parking cache, and public links
- **Event-day operations** — announcements, QR sharing, judge-call queue, and table/floor map for players and venue displays
- **OBS browser-source overlays** — transparent background, 1920×1080 optimized
- **Post-tournament analytics** at `/analytics/[tid]` — podium, win rates, round-by-round performance matrix
- **Round history viewer** — browse pairings and standings from every completed round
- **Winner screen** — full-screen champion celebration with link to analytics
- **Overtime clock** — counts up as `+MM:SS` once regulation time expires
- **Venue parking** — auto-fetches nearby parking from OpenStreetMap (Overpass) or Google Places; cached 1 hr; shown on the dashboard
- **Discord bot** — link any tournament to a Discord channel; receive live pairings, round-start timers, standings, and parking info via slash commands and automatic post-round notifications

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
│   │   ├── webhooks/topdeck/route.ts       ← Signed webhook receiver + Discord notifier
│   │   ├── live/[tid]/route.ts             ← SSE stream per tournament
│   │   ├── tournaments/[tid]/route.ts      ← REST state snapshot
│   │   ├── tournaments/[tid]/parking/      ← Parking API (geocode + cache + provider)
│   │   └── discord/interactions/route.ts  ← Discord slash-command interaction handler
│   ├── dashboard/[tid]/page.tsx            ← Live coverage dashboard (incl. parking)
│   ├── event/[tid]/page.tsx                ← Public mobile player companion page
│   ├── overlay/[tid]/                      ← OBS overlay pages
│   ├── analytics/[tid]/page.tsx            ← Post-tournament stats
│   └── venue/[tid]/page.tsx                ← Venue display (standings + clock)
├── components/
│   ├── RoundClock.tsx
│   ├── PairingsTable.tsx
│   ├── MatchResultsFeed.tsx
│   ├── LiveStandings.tsx
│   ├── PlayerRoster.tsx
│   ├── DroppedPlayers.tsx
│   ├── WinnerScreen.tsx
│   ├── RoundHistoryViewer.tsx
│   ├── EventCompanion.tsx                  ← Public player-facing event UI
│   ├── EventOperationsPanel.tsx            ← Announcements, QR, judge queue, floor map admin
│   ├── EventOpsPublic.tsx                  ← Public announcements, judge call, floor map widgets
│   ├── TournamentOpsPanel.tsx              ← Dashboard integration health panel
│   ├── DiscordSetupWizard.tsx              ← Dashboard Discord setup flow
│   └── ParkingSection.tsx                  ← Collapsible parking card (dashboard)
├── hooks/
│   └── useTournamentLive.ts                ← SSE hook
├── lib/
│   ├── env.ts
│   ├── prisma.ts
│   ├── topdeck/
│   │   ├── types.ts
│   │   ├── verify-signature.ts
│   │   ├── event-store.ts
│   │   ├── event-processor.ts
│   │   ├── tournament-state.ts
│   │   ├── analytics.ts
│   │   └── sse-publisher.ts
│   ├── parking/
│   │   ├── types.ts                        ← GeoPoint, ParkingResult, ParkingProvider
│   │   ├── distance.ts                     ← Haversine + walking minutes
│   │   ├── geocoder.ts                     ← Nominatim address → coordinates
│   │   ├── cache.ts                        ← DB-backed 1-hr cache
│   │   ├── factory.ts                      ← createParkingProvider()
│   │   └── providers/
│   │       ├── overpass.ts                 ← Free OpenStreetMap provider
│   │       └── google-places.ts            ← Google Places API v1 provider
│   └── discord/
│       ├── types.ts                        ← DiscordTournamentSettings, embeds
│       ├── rest.ts                         ← Bot REST client (send messages)
│       ├── verify.ts                       ← Ed25519 signature verification
│       ├── config-service.ts               ← DiscordLink CRUD
│       ├── notifier.ts                     ← Webhook → Discord post bridge
│       └── commands/
│           ├── index.ts                    ← Command definitions
│           ├── link.ts                     ← /topdeck link
│           ├── unlink.ts                   ← /topdeck unlink
│           ├── standings.ts                ← /topdeck standings
│           ├── pairings.ts                 ← /topdeck pairings
│           ├── parking.ts                  ← /topdeck parking
│           ├── settings.ts                 ← /topdeck settings
│           └── test.ts                     ← /topdeck test
├── scripts/
│   ├── send-test-event.ts                  ← Local webhook testing
│   └── register-discord-commands.ts        ← Slash command registration
├── prisma/schema.prisma
├── vercel.json
└── __tests__/
```

---

## Venue parking

The dashboard automatically shows nearby parking whenever a tournament has a venue location.  
No configuration is needed — the default provider uses free OpenStreetMap data.

### How it works

1. The dashboard sidebar has a **Parking** section (collapsed by default)
2. On first expand, it calls `GET /api/tournaments/[tid]/parking`
3. The API resolves the venue coordinates (direct `lat/lng` or Nominatim geocode)
4. Results are fetched from Overpass/OSM, cached for 1 hour, and returned
5. The dashboard renders an OpenStreetMap-based mini map with the venue and parking markers
6. Users can optionally add their device location to compare themselves against the venue and nearest parking
7. Users can mark where they parked; the car pin is stored locally in that browser for the tournament
8. Each result shows distance, walking time, price info, accessibility, and a Google Maps navigation link

### Choosing a parking provider

| Provider | Cost | Quality | Setup |
|---|---|---|---|
| `overpass` *(default)* | Free | Good — community-sourced OSM data | None — works out of the box |
| `google_places` | Paid per call | Excellent — hours, ratings, photos | Requires a Google Maps API key |

To switch to Google Places, set in `.env` / Vercel environment variables:

```env
PARKING_PROVIDER="google_places"
GOOGLE_MAPS_API_KEY="AIza..."
```

Enable **Places API (New)** in the [Google Cloud Console](https://console.cloud.google.com) for your key.  
If `GOOGLE_MAPS_API_KEY` is missing when `google_places` is selected, the app silently falls back to Overpass.

### Discord parking command

The `/topdeck parking` slash command posts a parking embed directly in Discord.  
It shares the same cache as the dashboard, so repeated calls are instant.

---

## Event-day operations

The dashboard includes organizer tools that make the overlay useful beyond stream graphics:

| Tool | Where it appears |
|---|---|
| Announcements | Dashboard composer; player page banner; venue display overlay; optional Discord post |
| QR / share | Dashboard QR code and share/copy actions for `/event/[tid]` |
| Judge queue | Player page request form; dashboard triage queue |
| Table / floor map | Dashboard editor; player page highlighted zone; venue display rotation |

Data is stored locally in Prisma:

- `TournamentAnnouncement`
- `JudgeCall`
- `TournamentFloorMap`

Discord setup also supports `/topdeck setup [tid]`, which links a channel when a tournament ID is provided and returns quick buttons for the player page, dashboard, and venue display.

---

## Discord bot

Link any tournament to a Discord channel and receive automatic live updates — pairings, round timers, standings, and parking info.

### Quick overview

| What | Detail |
|---|---|
| Interaction model | HTTP POST (serverless-compatible, no persistent gateway) |
| Signature verification | Ed25519 via [tweetnacl](https://github.com/dchest/tweetnacl-js) |
| Database | One `DiscordLink` row per linked tournament |
| Auto-posts | Configurable per link via `/topdeck settings` |

### Step 1 — Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it (e.g. "TopDeck Live")
3. Go to **Bot** → click **Add Bot** → confirm
4. Under **Bot → Token** click **Reset Token**, copy it → `DISCORD_BOT_TOKEN`
5. Under **General Information** copy **Application ID** → `DISCORD_CLIENT_ID`
6. Under **General Information** copy **Public Key** → `DISCORD_PUBLIC_KEY`

### Step 2 — Invite the bot to your server

Build the invite URL (replace `YOUR_CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

`2048` is the **Send Messages** permission. Paste the URL in a browser and invite to your server.

### Step 3 — Set environment variables

```env
DISCORD_BOT_TOKEN="Bot token from step 1"
DISCORD_CLIENT_ID="Application ID from step 1"
DISCORD_PUBLIC_KEY="Public key from step 1"
DISCORD_GUILD_ID="Your server ID (for instant dev registration — omit in prod)"
```

To find your **Guild ID**: in Discord, enable Developer Mode (*Settings → Advanced*), then right-click your server icon → **Copy Server ID**.

### Step 4 — Register slash commands

Run once after setting env vars. Uses your guild for instant registration (dev), or registers globally for production (~1 hour to propagate):

```bash
# Development (instant — guild-specific)
DISCORD_GUILD_ID="your_server_id" npm run discord:register

# Production (global — omit DISCORD_GUILD_ID in .env)
npm run discord:register
```

### Step 5 — Set the interactions endpoint URL

1. In the Discord Developer Portal → your app → **General Information**
2. Paste your deployment URL into **Interactions Endpoint URL**:

```
https://your-app.vercel.app/api/discord/interactions
```

3. Discord will send a `PING` request — the app must respond `{"type":1}` within 3 seconds to validate the endpoint.  
   Make sure the app is deployed and `DISCORD_PUBLIC_KEY` is set before saving.

> For local dev, expose port 3000 with [localtunnel](https://github.com/localtunnel/localtunnel):
> ```bash
> npx localtunnel --port 3000
> # Use: https://some-words.loca.lt/api/discord/interactions
> ```

### Slash commands

All commands are under the `/topdeck` group.

| Command | Permission | Description |
|---|---|---|
| `/topdeck link <tid>` | Manage Channels | Link the current channel to a tournament |
| `/topdeck unlink` | Manage Channels | Unlink the tournament from this channel |
| `/topdeck standings [top]` | Everyone | Post current standings (optional: show top N) |
| `/topdeck pairings` | Everyone | Post current round pairings |
| `/topdeck parking` | Everyone | Post nearby parking for the venue |
| `/topdeck settings` | Everyone | Show current notification settings (ephemeral) |
| `/topdeck test` | Manage Channels | Post a test embed to verify the bot is working |

### Automatic notifications

Once a channel is linked, the bot posts automatically when TopDeck events arrive:

| Event | Setting | Discord message |
|---|---|---|
| `round.published` | `postPairings` (default: on) | Pairings embed(s) for the new round |
| `round.started` | `postRoundStarted` (default: on) | "Round X has started!" with timer |
| `round.ended` | `postStandings` (default: on) | Standings embed after each round |
| `tournament.finished` | `postStandings` (default: on) | Final standings + winner |
| `tournament.checkin_started` | `postParking` (default: on) | Parking options near the venue |

Per-tournament settings are stored in the database and adjustable via `/topdeck settings` (view) — edit them directly in the `DiscordLink.settings` JSON column for now.

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
| `TOPDECK_WEBHOOK_SECRET` | `whsec_...` from TopDeck portal |
| `TOPDECK_API_KEY` | Your TopDeck API key (optional — for enrichment) |
| `DATABASE_URL` | Your production database URL (see note below) |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |
| `DISCORD_BOT_TOKEN` | Bot token (optional — Discord features) |
| `DISCORD_CLIENT_ID` | Application ID (optional — Discord features) |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key (optional — Discord features) |
| `PARKING_PROVIDER` | `"overpass"` (default) or `"google_places"` |
| `GOOGLE_MAPS_API_KEY` | Google Maps key (only if `PARKING_PROVIDER=google_places`) |

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
| `GET`  | `/api/tournaments/[tid]/parking` | Nearby parking (geocode → cache → provider) |
| `POST` | `/api/discord/interactions` | Discord slash-command interaction handler |

### Webhook security

- Signature header: `X-TopDeck-Signature: t=<unix>,v1=<hex-hmac-sha256>`
- HMAC message: `` `${t}.${rawBody}` ``
- Constant-time comparison via `crypto.timingSafeEqual`
- Timestamp tolerance: **5 minutes**
- Returns `401` for invalid signatures, `200` for valid ones

---

## Supported webhook events

| Event | State update | Discord notification |
|-------|-------------|---------------------|
| `ping` | Health check — logs and returns 200 | — |
| `tournament.checkin_started` | Sets metadata + check-in flag | Parking embed (if venue set) |
| `round.published` | Updates pairings; infers player roster | Pairings embed(s) |
| `round.started` | Starts the round clock | "Round X has started!" + timer |
| `match.result_reported` | Updates pairing result + results feed | — |
| `round.ended` | Updates standings; snapshots round into history | Standings embed |
| `tournament.finished` | Sets winner, final standings, finished flag | Final standings embed + winner |
| `player.registered` | Adds player to roster | — |
| `player.dropped` | Marks player as dropped | — |

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
| Parking data | OpenStreetMap / Overpass API (default) · Google Places API v1 (optional) |
| Discord | @discordjs/rest · Ed25519 via tweetnacl · HTTP interactions (serverless-safe) |

---

## Production notes

> **Multi-instance / horizontal scaling**: The SSE publisher uses an in-process subscriber map. If you run multiple server instances, replace `lib/topdeck/sse-publisher.ts` with a Redis pub/sub backend so all instances share the same event stream. On Vercel (single serverless function per request), this is not an issue.

> **Database in production**: SQLite (`file:./dev.db`) only works in single-process Node servers. For Vercel or any serverless host, use Turso (libSQL) or a Postgres provider — both work with Prisma and require only a `DATABASE_URL` change and a schema provider update.

# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Development server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint

# Database (Drizzle + PostgreSQL)
pnpm db:migrate       # Apply pending migrations
pnpm db:generate      # Generate new migration from schema changes
pnpm db:push          # Direct schema sync — dev/prototyping only (no migration trail)
pnpm db:baseline      # Baseline legacy DB (run before db:migrate on pre-migration DBs)
pnpm db:studio        # Database GUI
pnpm db:seed          # Seed race calendar + sessions; also invalidates Redis cache key session-banner:v1
pnpm db:seed-fantasy  # Seed fantasy season/rules/assets/prices
pnpm db:evolve-prices 2026 1 2  # Evolve asset prices from round 1 → round 2 based on performance
pnpm db:simulate-fantasy-users # Create or update simulated fantasy users, lock entries, and recalc scores

# Standings sync (Jolpica-F1 API)
pnpm db:sync-standings        # Sync driver + constructor standings + circuits from Jolpica-F1 API (current season)
pnpm db:sync-standings 2026   # Specify season
pnpm db:sync-standings 2026 3 # Sync standings + circuits + race/quali/sprint results + laps + pit stops from round 3

# Media sync (Cloudinary)
pnpm db:sync-pole-videos  # Upload public/videos/pole_NN.mp4 → Cloudinary + save URL in pole_videos table
pnpm db:migrate-cloudinary # Migrate existing local image URLs in DB to Cloudinary (idempotent)

# F1TV
pnpm f1tv:login       # Automated login via Playwright (reads F1TV_EMAIL + F1TV_PASSWORD from .env.local)
pnpm test:signalr     # Test SignalR connection to F1 Live Timing hub

# E2E
pnpm test:e2e         # Playwright suite
pnpm test:e2e:headed  # Playwright headed mode
```

## Architecture

### Routing & i18n
- All user-facing routes live under `app/[locale]/` — locales are `en`, `pt`, `es` with `localePrefix: 'always'`
- Never link to `/some-path` — always prefix with locale: `/[locale]/some-path`
- i18n config: `lib/i18n/routing.ts`. Use `Link`, `redirect`, `useRouter` from there, not from `next/navigation`
- Translation files: `messages/{en,pt,es}.json`

### API Routes
All API routes are under `app/[locale]/api/`:
- `drivers`, `teams`, `race-weekends`, `multimedia`, `news`, `gallery/[id]`
- `session-banner`, `session-results`, `session-analytics`, `lap-summaries`
- `race-control-messages`, `session-status-events`, `live-timing`
- `sync-standings` — POST trigger for Jolpica-F1 standings sync (same logic as CLI script)
- `f1tv/{content,streams,live,status}` — F1TV content browsing, stream URLs, live session detection, auth status

### DB Layer
- Single schema file: `lib/db/schema.ts` — all Drizzle table definitions and exported types
- DB client: `lib/db/client.ts`
- Query helpers per domain: `lib/db/{drivers,teams,news,multimedia,race-weekends,standings,...}.ts`
- Import pattern: `import { getDb } from '@/lib/db/client'` (returns `AppDatabase | null`) and `import { drivers } from '@/lib/db/schema'`
- Scripts must load env first: `import { config } from 'dotenv'; config({ path: '.env.local' })`

**Key tables:**
| Table | Purpose |
|---|---|
| `race_weekends` | Grand Prix calendar (season + round unique) |
| `race_sessions` | Individual sessions per weekend (FP1–3, Q, Race, Sprint…) |
| `drivers` | Driver profiles + season + career stats |
| `teams` | Constructor profiles + season standings |
| `news_articles` | Blog articles (body is `text[]`) |
| `media_galleries` + `gallery_images` | Photo galleries; `folder_key` is stable ID |
| `session_results` | Race/qualifying/sprint results per session (Q1-Q3 times, grid, laps, fastest lap rank) |
| `lap_summaries` | Per-lap timing data (from live timing or Jolpica API) |
| `pit_stops` | Pit stop data per session (lap, stop number, duration) |
| `circuits` | Circuit info with lat/lng, linked to `race_weekends` via `circuit_ref` |
| `tire_stints` | Tire compound stints per driver per session (from OpenF1, 2023+) |
| `session_weather` | Weather samples per session (from OpenF1, 2023+) |
| `race_control_messages`, `session_status_events` | Persisted session events |
| `race_intervals` | Gap-to-leader + interval-to-ahead per lap per driver (from OpenF1, 2023+) |
| `car_telemetry` | Pole lap telemetry samples: speed, throttle, brake, RPM, gear, DRS (from OpenF1, 2023+) |
| `team_radio` | Team radio recordings per session with lap correlation (from OpenF1, 2023+) |
| `pole_videos` | Cloudinary URLs for pole lap videos, keyed by season + round |
| `fantasy_seasons`, `fantasy_rulesets` | Fantasy season config, budget cap, transfer rules and lock policy |
| `fantasy_profiles` | MVP identity layer keyed by `session_key` |
| `fantasy_engineers` | Pit Wall Lead entities, one active record per team/season slice |
| `fantasy_assets` + `fantasy_asset_prices` | Tradeable fantasy assets and round-aware prices |
| `fantasy_round_entries` + `fantasy_round_holdings` | Locked lineup state per round |
| `fantasy_predictions` | Pole, winner, podium, fastest lap/pit and flags predictions |
| `fantasy_round_scores` + `fantasy_score_items` | Persisted total score and audit breakdown |

### Migration Workflow
Migrations are **manual SQL files** — do NOT rely on `drizzle-kit generate` interactively for renames:
1. Create `drizzle/000N_description.sql` manually
2. Register it in `drizzle/meta/_journal.json`
3. Run `pnpm db:migrate`

Current migration index: **32** (`0032_drop_media_videos.sql`)

### Cache Layer
- Redis client: `lib/cache/redis.ts`
- Session banner: `lib/cache/session-banner-cache.ts`
- The `session-banner:v1` Redis key is the primary cache for the homepage session banner; `pnpm db:seed` invalidates it
- Redis is required (`REDIS_URL`); session banner falls back to Postgres when Redis is unavailable

### Live Timing
- Single-source: **F1 SignalR Hub** via `livetiming.formula1.com/signalrcore`; F1MV/MultiViewer is no longer used
- SignalR client: `lib/live-timing/signalr/{client,topics,snapshot-bridge}.ts` — connects to `livetiming.formula1.com/signalrcore`, subscribes to 18 topics, accumulates state via deep-merge into `F1LiveTimingRawState`
- Snapshot bridge: translates SignalR push messages into the raw state shape consumed by parsers/UI
- Compressed topics (`CarData.z`, `Position.z`): base64-encoded deflate-raw, decompressed with `zlib.inflateRawSync`
- **Turbopack compatibility:** `@microsoft/signalr` uses internal `require()` calls — must be listed in `serverExternalPackages` in `next.config.mjs` so Node.js loads it natively instead of Turbopack bundling it. The client also uses dynamic `import('@microsoft/signalr')` to defer loading.
- Shared deep-merge utility: `lib/live-timing/utils/deep-merge.ts` — `deepMerge()` and `applyDelta()` used by both snapshot-bridge and recording/replay
- Client/parsers: `lib/live-timing/{api,parsers,formatters,constants}.ts`
- All TypeScript types for live data: `lib/live-timing/types.ts`
- Persistence layer: `lib/live-timing/persistence/` — snapshot store, file log, qualifying stores
- UI components: `components/live-timing/` (organized by domain: timing, weather, strategy, telemetry, etc.)
- Live Timing provider: `components/live-timing/LiveTimingProvider.tsx`
- Pages: `app/[locale]/live-timing/` + sub-routes for practice/qualifying/race

### Media (Cloudinary)
- Cloudinary: `cloud_name: di37e3spi`, base folder `f1blog/`
- `public/` is **staging only** — delete local files after confirming sync
- `folder_key` is the stable DB key — **never rename a folder after sync** (renaming orphans the old gallery and creates a duplicate)

**Gallery flow:** handled by `pnpm db:sync-fotos` in this repo — sync remains idempotent and updates `media_galleries` + `gallery_images`.
**Pole video flow:** place `pole_NN.mp4` (NN = zero-padded round) in `public/videos/` → `pnpm db:sync-pole-videos` → verify → delete local. `public/videos/` is gitignored — never commit video files.

### Jolpica-F1 API (Standings Sync)
- Client: `lib/jolpica/client.ts` — fetches driver standings, constructor standings, race results, qualifying, sprint, laps, pit stops, circuits
- DB sync: `lib/db/standings.ts` — maps Jolpica data to `drivers`, `teams`, `session_results`, `lap_summaries`, `pit_stops`, `circuits` tables
- Script: `scripts/sync-standings.ts` — CLI entry point (`pnpm db:sync-standings [season] [round]`)
- API route: `app/[locale]/api/sync-standings/route.ts` — POST endpoint for manual/cron trigger
- Team name aliases handled internally (e.g., Jolpica "Red Bull" → DB "Red Bull Racing")
- Standings queries order by `points DESC, position ASC` to handle missing/zero position values gracefully

### OpenF1 API (Enrichment Data)
- Client: `lib/openf1/client.ts` — fetches stints, laps, weather, pit data, drivers, sessions from `api.openf1.org/v1`
- DB sync: `lib/db/openf1-sync.ts` — `syncTireStints()`, `enrichLapSummariesWithOpenF1()`, `syncSessionWeather()`
- Integrated into `scripts/sync-standings.ts` as step 8 (after Jolpica sync, non-critical failure)
- Data available from 2023+ only; session matching via country name from `race_weekends` table
- Enriches `lap_summaries` with speed trap data (`i1_speed`, `i2_speed`, `st_speed`) and `compound`
- Populates `tire_stints` (compound, lap range, tyre age) and `session_weather` (sampled at 60s intervals)
- **Caveat:** OpenF1 may omit stint #1 for some drivers (sensor registration delay); compound can be `null` — handle with `?.toUpperCase()`
- **Caveat:** OpenF1 rate limits aggressively (429); enrichment step is non-critical and logged as warning on failure
- Overtakes enrichment was removed in Mar/2026 (table dropped by migration `0029_drop_overtakes.sql`).

### Analytics Dashboard
- Page: `app/[locale]/analytics/page.tsx` — round selector + tabbed analysis views (season fixed to 2026 via `FIXED_SEASON` constant in `analytics-dashboard.tsx`)
- Tab order: Qualifying → Pole X-Ray → Race Pace → Gap to Leader → Strategy → Reliability → Head-to-Head → Championship
- API routes: `app/[locale]/api/analytics/{race-weekends,race-pace,qualifying,grid-vs-finish,pit-strategy,championship,teammate-h2h,reliability,pole-xray,gap-evolution,pole-video}`
- Charts: `components/analytics/` — Recharts-based visualizations with dark theme
- Shared utils: `lib/analytics/{types,session-resolver,lap-time-parser,driver-colors}.ts`
- Tire compound colors: SOFT=red, MEDIUM=yellow, HARD=gray (#d1d5db), INTERMEDIATE=green, WET=blue
- Race Pace chart supports multi-driver selection (up to 4 simultaneous) for pace comparison
- Gap to Leader Top 5/Top 10 uses race finishing order (from `session_results.position`).

#### Pole X-Ray tab
- Split-screen: video player (left, 5/12) + telemetry charts (right, 7/12)
- Video served from Cloudinary via `pole_videos` table; resolved by `GET /api/analytics/pole-video?season=&round=`
- Bidirectional sync: video `timeupdate` → moves cursor line across Speed/Throttle-Brake/Gear charts; click on chart → seeks video
- Live readout panel shows Speed, RPM, Throttle, Brake (gauges), Gear, DRS at current playback position
- Telemetry timestamps: API returns `relativeMs` (offset from first sample) for accurate time mapping
- To add a pole video: place `pole_NN.mp4` in `public/videos/` → `pnpm db:sync-pole-videos` → delete local file

### Fantasy Pitwall
- Page: `app/[locale]/fantasy/page.tsx`
- Dashboard container: `components/fantasy/fantasy-dashboard.tsx`
- Backend helpers: `lib/db/fantasy-core.ts`, `lib/db/fantasy-assets.ts`, `lib/db/fantasy-draft.ts`, `lib/db/fantasy-scoring.ts`, `lib/db/fantasy-leaderboard.ts`
- API routes: `app/[locale]/api/fantasy/{bootstrap,assets,engineers,draft,draft/lineup,draft/predictions,review,lock,result,score,leaderboard}`
- Shared DTOs/client: `lib/fantasy/types.ts`, `lib/fantasy/client.ts`
- UI cards: `components/fantasy/*`

Current business rules:
- Roster = `2` drivers + `1` team + `1` Pit Wall Lead + predictions
- Budget cap = `100`
- Team hold minimum = `3` rounds
- Lock happens at qualifying start
- MVP identity uses `sessionKey`, not real auth
- Pit Wall Lead is globally selectable from all teams, not filtered by chosen drivers

Current scoring notes:
- Drivers, team, Pit Wall Lead and predictions are persisted separately in `fantasy_round_scores`
- Breakdown items are persisted in `fantasy_score_items`
- Score is provisional/live until persisted race results exist; then `isOfficial` becomes true
- **Driver scoring** = individual merit: qualifying/sprint/race position, overtakes (grid→finish), fastest lap, teammate beats
- **Team scoring** = collective result + mechanical execution: Q3 presence, both-car finishes/points, podiums, wins, pit crew speed (exclusive to Team)
- **Pit Wall Lead scoring** = strategic decisions: top-5 quali execution, race strategy gain, points conversion, undercut/overcut detection, SC window timing, clean race management; DNF penalty is shared but lighter than Team
- No overlap between Team and Engineer on pit crew (Team owns pit speed, Engineer owns pit timing strategy)
- Rules page: `app/[locale]/fantasy/rules/page.tsx`

Price evolution:
- Logic: `lib/db/fantasy-pricing.ts` — `evolveFantasyPrices(season, fromRound, toRound)`
- CLI: `pnpm db:evolve-prices <season> <fromRound> <toRound>` (run after a round is officially scored)
- API: `POST /api/fantasy/evolve-prices` with `{ season, fromRound, toRound }`
- Algorithm: base price from current standings + delta from recent fantasy score performance (3-round window) vs expected performance. Delta capped at ±3.0/round. Floor/ceiling per asset type enforced.
- Driver: 8–32 credits, Team: 10–30 credits, Engineer: 6–18 credits
- Workflow: sync standings → score round → evolve prices → next round is ready
- **Post-round endpoint**: `POST /api/fantasy/post-round` with `{ season, round }` — unified pipeline that runs all 5 phases: (1) sync standings + circuits, (2) sync race/quali/sprint/laps/pits for the round, (3) OpenF1 enrichment (non-critical), (4) score all locked entries, (5) evolve prices for round+1. Returns step-by-step status. `maxDuration = 120s`.

Testing notes:
- Stable Playwright runs should prefer production mode on port `3010` with `PLAYWRIGHT_SKIP_WEBSERVER=1`
- Existing fantasy E2E coverage includes: happy path, global Pit Wall Lead selection, post-lock mutation blocking, and opening a finished round with persisted breakdown
- Simulation script `scripts/simulate-fantasy-users.ts` creates 10 reusable fantasy sessions (`fantasy-sim-01` … `fantasy-sim-10`) for leaderboard inspection across rounds

### Schedule Auto-Advance
- `components/schedule-section.tsx` uses a `now` state that refreshes every 60s via `setInterval`
- This ensures the highlighted "next race" advances automatically after a GP ends without requiring a page reload
- Race and session times are rendered in the user local timezone from UTC fields (`raceStartUtc`, `startTimeUtc`).

### Source of Truth for Calendar Data
`scripts/seed-data/race-calendar-data.ts` is the **single source of truth** for race calendar and sessions.
All consumers must read from it — never hardcode dates/sessions in:
- `components/schedule-section.tsx`
- `components/race-detail-modal.tsx`
- `scripts/seed-weekend-sessions.ts`

### Editorial Automation Pipeline
- **Goal:** Autogenerate rich, factually accurate Grand Prix weekend articles (Practice, Qualifying, Sprint, Race sessions and Previews) in Portuguese.
- **Workflow:**
  1. **Scheduler (`scripts/session-scheduler.ts`):** Scans completed sessions (last 60 days) and upcoming races (within 4 days, typically on Thursday) to insert assignments into `editorial_assignments` using a DB-based queue.
  2. **Pipeline Orchestrator (`lib/editorial/pipeline.ts`):** Runs each due assignment:
     - **Classification (`lib/editorial/assignment-classifier.ts`):** Matches GP names and resolves sessions.
     - **Deduplication (`lib/editorial/dedupe.ts`):** Prevents duplicate coverage for the same session.
     - **Source Packet Compiler (`lib/editorial/source-packet-builder.ts`):** Gathers race results, standings, pit stops, tire stints, weather, and race control logs.
     - **AI Writing (`lib/editorial/writer.ts`):** Loads specialized templates (`resultado-gp`, `resultado-qualifying`, `preview`, `noticias`, `raio-x-tecnico`) and writes markdown-formatted sports chronicles (using H3 headers and classification tables/lists).
     - **Fact-Checking (`lib/editorial/fact-checker.ts`):** Runs an independent audit verifying winners, standings, and events against actual sources. Rejects articles on failure.
     - **Persistence:** Successful drafts are saved to `pending_articles` for human review.
- **Key Commands:**
  - `pnpm exec tsx scripts/session-scheduler.ts --topics` to execute the queue.

### Admin
- `app/[locale]/admin/` — currently unprotected (auth TODO per README)
- Manages news articles (`app/[locale]/admin/news/`)

### F1TV Integration (merged to main — all 4 phases complete)
- Full plan: `F1TV_LIVE_PLAN.md`
- Goal: replace F1MV dependency with native SignalR connection + F1TV video streaming

#### Auth (`lib/f1tv/auth.ts`)
- Token loaded at startup via `instrumentation.ts`: checks `F1TV_TOKEN` env var first, then falls back to Redis key `f1tv:token`
- Auto-renewal scheduler: when `F1TV_EMAIL` and `F1TV_PASSWORD` are configured, `instrumentation.ts` starts `lib/f1tv/auto-renewal-scheduler.ts`; it schedules the first attempt at `race_sessions.start_time_utc - 24h` for the next `Practice 1`/`Pratice 1`/`P1`/`FP1` session, retries hourly after failures, and uses `F1TV_PROXY_URL` derived to `/f1tv/auth` (or `F1TV_PROXY_AUTH_URL`) + `x-f1tv-proxy-secret` for auth when configured. Disable with `F1TV_AUTO_RENEW_ENABLED=0`.
- Token validation: checks JWT `exp` + `SubscriptionStatus === 'active'`
- `isAuthenticated()` lazily loads token from env/memory on first call
- **Local renewal:** `pnpm f1tv:login` — opens Chromium (anti-bot headers set), you log in manually, cookie captured automatically, saved to `.env.local`
- **Local admin renewal:** `/admin/f1tv` page — paste `login-session` cookie value from browser DevTools; server validates JWT, activates in memory, saves to Redis for persistence across restarts
- Token store: `lib/f1tv/token-store.ts` — `saveTokenToRedis()` / `loadTokenFromRedis()` using Redis key `f1tv:token`
- Admin page: `app/[locale]/admin/f1tv/page.tsx` — shows status (days remaining, subscription), paste-token tab + credentials tab

#### F1TV Content API (`lib/f1tv/client.ts`)
- `searchVod()` — browse VOD catalog by season; F1TV returns meeting-level BUNDLE containers
- `getContentVideo()` — get single content metadata including `additionalStreams` (camera channels)
- `getContentPlayUrl()` — get DASH/HLS stream URL for playback (requires entitlement token)
- Content hierarchy: Season → Meetings (BUNDLE) → detail page → Sessions (VIDEO with REPLAY/HIGHLIGHTS/ANALYSIS subtypes)
- `fetchMeetingPage()` in content API route resolves detail page URI → extracts VIDEO items from `retrieveItems.resultObj.containers`

#### Video Player (`components/live/f1tv-player.tsx`)
- Dual-format: auto-detects DASH (`.mpd` or streamType contains "DASH") → `dashjs`, else → `hls.js`
- HLS fallback for Safari native playback
- Controls: play/pause, mute, fullscreen; `onTimeUpdate` callback for sync

#### Pages
- `app/[locale]/live/` — auto-detects live F1TV sessions, loads WIF stream + timing table (split 5/12 + 7/12)
- `app/[locale]/replay/` — two-level browser: meetings grid (auto-loads current year) → session list → player with multi-cam

#### API Routes (`app/[locale]/api/f1tv/`)
- `auth` — `GET`: token status (authenticated, daysRemaining, name, subscription); `POST { token }`: activate pasted cookie; `POST { email, password }`: server-side login (blocked by F1 WAF in most environments)
- `content` — three modes: `?contentId=N` (single lookup), `?meetingUri=...` (session list), `?season=&q=` (search meetings)
- `streams` — get playable stream URL for contentId + optional channelId
- `entitlement` — returns subscriptionToken + entitlementToken for client-side use
- `live` — currently live F1TV sessions
- `status` — auth status + SignalR connection state

#### Local F1TV playback
- This app is intended to run on this machine or another local machine, not on Vercel/Hetzner.
- F1TV playback requests originate from the local machine running the app.
- Optional proxy variables (`F1TV_PROXY_URL`, `F1TV_MPD_PROXY_URL`, `F1TV_SEGMENT_PROXY_URL`, `F1TV_AUDIO_PROXY_URL`) remain supported only for local networks that need custom routing.

#### Multi-Camera (`components/live/multi-cam-selector.tsx`)
- Channels: World Feed (WIF), Pit Lane (PRES), Data Channel, Tracker + expandable onboard grid per driver
- Driver onboards show racing number in team color

#### CSP
- `connect-src` includes `f1tv-proxy.blackboxinovacao.com.br`, `ott-video-fer-cf.formula1.com`, `ott-video-cf.formula1.com`, `f1tv.formula1.com`, `livetiming.formula1.com`, Akamai hosts, DRM hosts
- `media-src` includes `blob:` for HLS.js blob URLs

#### DASH-WV playback notes
- `/api/f1tv/streams` returns DASH MPD URLs proxied through `/api/f1tv/mpd`; do not bypass this path for DASH-WV streams
- `/api/f1tv/mpd` fetches the signed MPD through `F1TV_MPD_PROXY_URL`, strips HEVC/H.265 adaptation sets, and rewrites segment URLs to `F1TV_SEGMENT_PROXY_URL`
- `F1TV_SEGMENT_PROXY_URL` is called directly by dash.js and must be allowed by CSP; it is public and protected by strict host allowlisting in the proxy
- Expected successful segment names use `AVC`, not `HEVC`

#### Session Recording & Replay (Phase 4)
- Recorder: `lib/live-timing/recording/recorder.ts` — captures SignalR messages as NDJSON via `onFeed` hook
- Storage: `lib/live-timing/recording/storage.ts` — list/read/delete recordings from `data/recordings/` (gitignored)
- Player: `lib/live-timing/recording/player.ts` — client-side playback engine with speed control (0.5x–10x), seek, pause
- `ReplayTimingProvider`: feeds replay state into the same `LiveTimingContext` — all existing timing components work unchanged
- Recording auto-starts when `RECORDING_ENABLED=1` and SignalR connects; auto-stops on session `Finalised`
- Periodic snapshots (every 60s) in NDJSON enable fast seek without replaying all deltas from start
- API routes: `app/[locale]/api/recording/` — list, start/stop, serve NDJSON, delete, extract timeline events
- Replay viewer: `app/[locale]/replay/[sessionKey]/` — playback bar + timing table + team radio
- Replay page (`/replay`) shows recorded sessions above F1TV VOD browser

#### Session Scheduler (`lib/live-timing/scheduler.ts`)
- Checks `race_sessions` every 5 min for sessions starting within 60 min
- Auto-activates SignalR + recording when a session is approaching
- Enabled via `AUTO_CONNECT_ENABLED=1`
- Runs via `instrumentation.ts` (Next.js server startup hook)
- Recording auto-stops when session reaches `Finalised` status

#### Turbopack / Next.js Config
- `@microsoft/signalr` must be in `serverExternalPackages` in `next.config.mjs` — the package uses internal `require()` calls that Turbopack cannot bundle
- SignalR client uses dynamic `import('@microsoft/signalr')` and `import { inflateRawSync } from 'zlib'` (static import, not `require()`)
- `state.connection` typed as `unknown` in client to avoid top-level `signalR.*` type imports; casted at call sites

#### Key constraints
- SignalR snapshot bridge outputs identical `F1LiveTimingRawState` — zero changes to parsers/UI
- Reference repos (API docs only, no code copying): eXhumer/f1tv-api (AGPL), JustAman62/undercut-f1 (MIT)

## Environment Variables

```bash
DATABASE_URL        # PostgreSQL (use sslmode=disable for local without SSL)
UPSTASH_REDIS_REST_URL_KV_REST_API_URL    # optional Upstash Redis REST URL
UPSTASH_REDIS_REST_URL_KV_REST_API_TOKEN  # optional Upstash Redis REST token
REDIS_SESSION_BANNER_TTL_SECONDS  # optional, suggested: 30
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
F1TV_EMAIL          # F1TV Pro account email (used by pnpm f1tv:login)
F1TV_PASSWORD       # F1TV Pro account password (used by pnpm f1tv:login)
F1TV_TOKEN          # F1TV login-session cookie — auto-saved by pnpm f1tv:login locally;
                    # can also be set via /admin/f1tv (persisted to Redis automatically)
F1TV_AUTO_RENEW_ENABLED # "0" to disable automatic renewal 24h before Practice 1 (default: enabled)
SIGNALR_HUB_URL     # optional SignalR hub/proxy URL (default: https://livetiming.formula1.com/signalrcore)
RECORDING_ENABLED   # "1" to auto-record SignalR sessions to data/recordings/ (default: off)
AUTO_CONNECT_ENABLED # "1" to auto-connect SignalR 60min before scheduled sessions (default: off)
# F1TV_PROXY_URL    # optional local/network proxy base URL for F1TV auth/stream URLs
# F1TV_PROXY_AUTH_URL # optional exact auth proxy endpoint; defaults to F1TV_PROXY_URL derived to /f1tv/auth
# F1TV_PROXY_SECRET # optional shared secret for proxy authentication
```

## Key Conventions
- Commit messages: Conventional Commits in English (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- No direct `next/navigation` imports — use `lib/i18n/routing.ts` exports
- `drizzle-kit generate` is interactive — create SQL migrations manually when renaming columns
- After any seed run, Redis cache is auto-invalidated for `session-banner:v1`
- Do NOT leave `tmp-*` debug files in the repo root — delete after use

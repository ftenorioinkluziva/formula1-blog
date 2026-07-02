# F1TV Live — Implementation Plan
> Created: 2026-03-13
> Status: All 4 phases implemented

---

## Goal

Eliminate the dependency on F1 MultiViewer (F1MV) by connecting directly to:
1. **F1 SignalR Hub** — native live timing data (replaces F1MV GraphQL proxy)
2. **F1TV API** — authenticated video streaming (replays, onboards, live sessions)

This enables any deployment to receive live timing data and stream video content without a local F1MV desktop application.

---

## Current Architecture (F1MV-dependent)

```
F1 SignalR Hub
     ↓
F1 MultiViewer (desktop app, must be logged in)
     ↓ GraphQL on localhost:10101 (or remote Hetzner server)
lib/live-timing/persistence/live-timing-snapshot-store.ts
     ↓ fetchUpstreamLiveTimingState() — POST to GQL_ENDPOINT
Snapshot Store (in-memory, TTL adaptive 500-5000ms)
     ↓
GET /[locale]/api/live-timing (mode=latest|history|stats|qualifying-best-laps)
     ↓
LiveTimingProvider.tsx (React context, 200ms polling)
     ↓ parsers.ts (20+ parser functions)
UI Components (timing tables, charts, maps, radio, race control)
```

**Pain points:**
- F1MV must run on a server with a display (Xvfb + VNC for login)
- Manual F1TV login required before each session via VNC
- Single point of failure — if F1MV crashes, all live data stops
- GraphQL proxy adds latency vs direct SignalR subscription

---

## Target Architecture

```
┌─────────────────────────────────────────────────┐
│                  F1 SignalR Hub                   │
│        (livetiming.formula1.com/signalr)         │
└──────────────────────┬──────────────────────────┘
                       │ SignalR (WebSocket/SSE)
                       ↓
        lib/live-timing/signalr/client.ts
        (native @microsoft/signalr connection)
                       │
                       ↓
        lib/live-timing/signalr/snapshot-bridge.ts
        (transforms SignalR messages → F1LiveTimingRawState)
                       │
                       ↓
        ┌──────────────────────────────┐
        │   Snapshot Store (existing)   │  ← ZERO changes to this layer
        │   Parsers (existing)          │
        │   API Route (existing)        │
        │   LiveTimingProvider (exist.)  │
        │   UI Components (existing)    │
        └──────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              F1TV Content API                    │
│    (f1tv-api.formula1.com/agl/1.0/)             │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS + JWT (ascendonToken)
                       ↓
        lib/f1tv/auth.ts          — login, token refresh
        lib/f1tv/client.ts        — content browse, stream URLs
        lib/f1tv/types.ts         — API response types
                       │
                       ↓
        app/[locale]/live/        — new live viewer pages
        components/live/          — video player, multi-cam, replay browser
```

---

## Data Sources Comparison

### SignalR Topics (17 data points from F1 Live Timing)

These are the same topics F1MV consumes and re-exposes via GraphQL. Reference: [undercut-f1](https://github.com/JustAman62/undercut-f1) processors.

| SignalR Topic | Current via F1MV | Direct SignalR | Notes |
|---|---|---|---|
| `DriverList` | ✅ | ✅ | Static driver/team metadata |
| `TimingData` | ✅ | ✅ | Lap times, gaps, sectors, speeds, pit status |
| `TimingAppData` | ✅ | ✅ | Tire stints, compound, tyre age |
| `TimingStats` | ✅ | ✅ | Best sectors, best speeds |
| `WeatherData` | ✅ | ✅ | Air/track temp, humidity, wind, rain |
| `WeatherDataSeries` | ✅ | ✅ | Historical weather samples |
| `SessionInfo` | ✅ | ✅ | Meeting, circuit, session type |
| `SessionStatus` | ✅ | ✅ | Started/Finished/Inactive |
| `ExtrapolatedClock` | ✅ | ✅ | Remaining time, paused state |
| `TopThree` | ✅ | ✅ | P1/P2/P3 summary |
| `TrackStatus` | ✅ | ✅ | Green/Yellow/Red/SC/VSC flags |
| `RaceControlMessages` | ✅ | ✅ | FIA messages, investigations, penalties |
| `TeamRadio` | ✅ | ✅ | Audio URIs for team radio clips |
| `LapCount` | ✅ | ✅ | Current/total laps |
| `LapSeries` | ✅ | ✅ | Position per lap history |
| `Position` | ✅ | ✅ | Car X/Y/Z coordinates |
| `PitLaneTimeCollection` | ⚠️ Partial | ✅ | Pit stop durations |
| `ChampionshipPrediction` | ✅ | ✅ | Live points prediction |
| `ContentStreams` | ✅ | ✅ | Video stream URIs |
| `AudioStreams` | ✅ | ✅ | Commentary URIs |
| `SessionData` | ⚠️ Partial | ✅ | Qualifying parts, timeline |
| `CarData` | 🚫 Removed | Available | RPM, speed, gear, throttle, brake — was removed in v3.8 |
| `Heartbeat` | ❌ | ✅ | Connection keepalive |

### F1TV Content API (video streaming)

| Capability | Description | Requires |
|---|---|---|
| `searchVod()` | Browse VOD catalog (replays, highlights, shows) | F1TV subscription |
| `contentPlay()` | Get HLS/DASH stream URL for playback | F1TV Pro + ascendonToken |
| `contentVideo()` | Video metadata (onboards, WIF, pit lane, data channel) | Location data |
| `liveNow()` | Currently live content | Location data |
| `picture()` | Official image assets (posters, thumbnails) | None |

**Stream types available:** DASH, DASHWV (Widevine DRM), HLS
**Channels:** World Feed (WIF), per-driver onboard cameras (OBC), Pit Lane, Data Channel, Tracker
**Languages:** EN, NL, PT, ES, DE, FR

---

## Implementation Phases

### Phase 1 — Foundation: F1TV Auth + SignalR Client

**Goal:** Establish authenticated connection to both F1 services.

#### New files

```
lib/f1tv/
├── auth.ts              — Token validation + state management (browser-based login)
├── client.ts            — F1TV API client (browse, play, search)
└── types.ts             — TypeScript interfaces for F1TV API responses

lib/live-timing/signalr/
├── client.ts            — Native SignalR connection to F1 Live Timing hub
├── topics.ts            — Topic subscription and message routing
└── snapshot-bridge.ts   — Transform SignalR messages → F1LiveTimingRawState format

scripts/
├── f1tv-login.ts        — Interactive login helper (opens browser, captures cookie)
└── test-signalr.ts      — SignalR connection test script
```

#### Environment variables

```bash
F1TV_TOKEN="..."                    # login-session cookie from F1 account (run pnpm f1tv:login)
LIVE_TIMING_SOURCE="signalr"       # "signalr" (direct) or "f1mv" (legacy proxy)
```

#### Auth flow

F1 uses browser-based authentication (no public API for programmatic login).
The `login-session` cookie contains a URL-encoded JSON with the `subscriptionToken` (JWT).

```
1. Set F1TV_EMAIL and F1TV_PASSWORD in .env.local
2. Run `pnpm f1tv:login`
3. Playwright opens Chromium, fills login form, submits automatically
4. Script polls cookies until `login-session` appears (~2-5 seconds)
5. Extracts subscriptionToken JWT, validates it, saves F1TV_TOKEN to .env.local
6. Token used for F1TV content API + SignalR connection
7. Token expires after ~24h — re-run `pnpm f1tv:login` when expired
```

#### SignalR connection flow

```
1. Negotiate connection at livetiming.formula1.com/signalr/negotiate
2. Establish WebSocket (preferred) or SSE fallback
3. Subscribe to all 17+ topics
4. On message: route to snapshot-bridge.ts
5. snapshot-bridge accumulates state → outputs F1LiveTimingRawState
6. Feed into existing Snapshot Store (same interface as F1MV GraphQL response)
```

#### Key design decision: Snapshot Bridge

The bridge must produce the **exact same `F1LiveTimingRawState` shape** that the existing GraphQL fetch returns. This ensures:
- Zero changes to `parsers.ts` (20+ functions)
- Zero changes to `LiveTimingProvider.tsx`
- Zero changes to any UI component
- Dual-source support (F1MV or SignalR) via `LIVE_TIMING_SOURCE` env var

---

### Phase 2 — Transparent Live Timing Migration

**Goal:** Replace F1MV polling with SignalR push, maintaining identical UI behavior.

#### Changes to existing files

```
lib/live-timing/persistence/live-timing-snapshot-store.ts
  ├── Add SignalR source option alongside GraphQL fetch
  ├── When LIVE_TIMING_SOURCE=signalr: receive push updates from bridge
  ├── When LIVE_TIMING_SOURCE=f1mv: existing GraphQL polling (unchanged)
  └── Same output interface regardless of source

lib/live-timing/constants.ts
  └── Add LIVE_TIMING_SOURCE config reading
```

#### Benefits over F1MV

| Aspect | F1MV (current) | SignalR (new) |
|---|---|---|
| Latency | ~500ms (poll + proxy) | ~50ms (push) |
| Dependencies | Desktop app + Xvfb + VNC | None (pure Node.js) |
| Reliability | Single point of failure | Auto-reconnect built-in |
| Server setup | Complex (display, systemd, VNC login) | Just env vars |
| Data freshness | Poll-based (500-5000ms TTL) | Event-driven (real-time push) |

#### Rollback safety

If SignalR fails during a session, automatic fallback to F1MV if `F1MV_API_URL` is configured. The `LIVE_TIMING_SOURCE` can be changed at runtime via env var without restart.

---

### Phase 3 — Video Streaming Integration

**Goal:** Embed F1TV video content (live sessions, replays, onboards) in the app.

#### New files

```
app/[locale]/live/
├── page.tsx                    — Live session viewer (split: video + timing)
├── replay/page.tsx             — Replay browser + player
└── layout.tsx                  — Shared layout for live pages

components/live/
├── f1tv-player.tsx             — HLS/DASH video player (hls.js / dash.js)
├── multi-cam-selector.tsx      — Channel switcher (WIF, onboards, pit lane)
├── content-browser.tsx         — Browse seasons/events/sessions
├── replay-player.tsx           — VOD player with timeline scrubber
└── live-session-layout.tsx     — Split layout: video left + timing right

app/[locale]/api/f1tv/
├── auth/route.ts               — Login endpoint (server-side token management)
├── streams/route.ts            — Get stream URL for content ID
├── content/route.ts            — Browse available content
└── live/route.ts               — Currently live sessions
```

#### Video player strategy

- **DASH streams:** Use `dashjs` — F1TV VOD content returns DASH (`.mpd`) by default, even with `WEB_HLS` platform
- **HLS streams:** Use `hls.js` — live sessions may return HLS; Safari uses native `<video>` fallback
- Auto-detection: player checks `streamType.includes("DASH")` or `.mpd` extension

#### Live session layout

```
┌──────────────────────────────────────────────────────────┐
│  [WIF] [HAM] [VER] [LEC] [PIT] [DATA]   Channel selector │
├────────────────────────┬─────────────────────────────────┤
│                        │  Timing Table                    │
│    Video Player        │  (existing component)            │
│    (5/12 width)        │  (7/12 width)                    │
│                        │                                  │
│                        ├─────────────────────────────────┤
│                        │  Race Control / Weather / Radio  │
│                        │  (collapsible panels)            │
└────────────────────────┴─────────────────────────────────┘
```

---

### Phase 4 — Session Recording & Replay

**Goal:** Record live SignalR data for post-session replay and analysis.

#### New files

```
lib/live-timing/recording/
├── recorder.ts          — Capture SignalR messages with timestamps to NDJSON
├── player.ts            — Replay recorded sessions at configurable speed
└── storage.ts           — Manage recorded session files (list, delete, metadata)

app/[locale]/replay/
├── page.tsx             — Session library (list recorded + F1TV VOD sessions)
└── [sessionId]/page.tsx — Replay viewer (recorded timing + optional F1TV video)
```

#### Recording format

```jsonl
{"ts": 1710000000000, "topic": "TimingData", "data": {...}}
{"ts": 1710000000200, "topic": "WeatherData", "data": {...}}
{"ts": 1710000000500, "topic": "RaceControlMessages", "data": {...}}
```

#### Replay features

- Adjustable playback speed (0.5x, 1x, 2x, 5x, 10x)
- Timeline scrubber with key events marked (flags, pit stops, incidents)
- Sync with F1TV VOD replay (offset matching)
- Export data snapshots at any point

---

## Dependencies

### New npm packages

| Package | Purpose | Phase |
|---|---|---|
| `@microsoft/signalr` | SignalR client for Node.js/browser | 1 |
| `jsonwebtoken` | JWT token validation | 1 |
| `jwks-rsa` | JWKS key retrieval for token verification | 1 |
| `hls.js` | HLS video playback in browser | 3 |
| `dashjs` | DASH video playback in browser (F1TV VOD uses DASH) | 3 |

### Existing packages (already in project)

- `undici` / `fetch` — HTTP requests to F1TV API
- `recharts` — Charts (existing)
- All UI components (shadcn, radix, tailwind)

---

## Environment Variables (Complete)

```bash
# F1TV Authentication (Phase 1)
F1TV_EMAIL="..."                            # F1TV Pro account email (used by pnpm f1tv:login)
F1TV_PASSWORD="..."                         # F1TV Pro account password (used by pnpm f1tv:login)
F1TV_TOKEN="..."                            # Auto-saved by pnpm f1tv:login (login-session cookie)
F1TV_PROXY_URL="..."                        # Optional regional proxy for F1TV CONTENT/PLAY requests
F1TV_MPD_PROXY_URL="..."                    # Required in production for signed CDN MPD fetches; prevents 302 fallback to HEVC MPD
F1TV_SEGMENT_PROXY_URL="..."                # Required in production for CORS-enabled DASH segment fetches
F1TV_PROXY_SECRET="..."                     # Shared secret sent as x-f1tv-proxy-secret

# Live Timing Source Selection (Phase 2)
LIVE_TIMING_SOURCE="signalr"               # "signalr" | "f1mv" (default: "f1mv" for backward compat)

# Session Recording & Auto-Connect (Phase 4)
RECORDING_ENABLED="1"                      # Auto-record SignalR sessions to data/recordings/
AUTO_CONNECT_ENABLED="1"                   # Auto-connect SignalR 60min before scheduled sessions

# Existing (unchanged)
F1MV_API_URL="http://localhost:10101/api/graphql"  # Legacy F1MV fallback
DATABASE_URL="..."
REDIS_URL="..."
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| F1 changes SignalR hub URL/protocol | Live timing breaks | Monitor undercut-f1 repo for updates; version-pin connection params |
| F1TV blocks automated login | No video streaming | Graceful degradation; timing data works independently |
| DRM prevents browser playback | Some streams unplayable | Use shaka-player; fall back to HLS-only streams |
| SignalR rate limiting | Connection throttled | Respect connection limits; single persistent connection |
| ascendonToken expiry during session | Data interruption | Auto-refresh loop with buffer before expiry |
| AGPL license of f1tv-api | Legal risk if code copied | Do NOT copy code; reimplement HTTP calls from API knowledge only |

---

## Turbopack Compatibility

`@microsoft/signalr` uses internal `require()` calls that Turbopack cannot bundle. Solution:

1. Add `serverExternalPackages: ['@microsoft/signalr']` in `next.config.mjs` — Node.js loads the package natively
2. SignalR client uses `async function loadSignalR() { return await import('@microsoft/signalr') }` instead of top-level import
3. `state.connection` typed as `unknown` to avoid top-level `signalR.*` type references; casted at call sites
4. `zlib` uses static `import { inflateRawSync } from 'zlib'`, not `require('zlib')`

---

## Reference Projects

| Project | What we learn from it | License concern |
|---|---|---|
| [eXhumer/f1tv-api](https://github.com/eXhumer/f1tv-api) | F1TV API endpoints, auth flow, content model, stream types | AGPL-3.0 — do NOT copy code, only use as API documentation |
| [JustAman62/undercut-f1](https://github.com/JustAman62/undercut-f1) | SignalR topics, data point models, connection flow, processors | MIT — safe to reference |

---

## File Impact Summary

### New files (no existing code touched in Phase 1)

```
lib/f1tv/auth.ts
lib/f1tv/client.ts
lib/f1tv/types.ts
lib/live-timing/signalr/client.ts
lib/live-timing/signalr/topics.ts
lib/live-timing/signalr/snapshot-bridge.ts
```

### Modified files (Phase 2 only — minimal changes)

```
lib/live-timing/persistence/live-timing-snapshot-store.ts  — add SignalR source option
lib/live-timing/constants.ts                                — add LIVE_TIMING_SOURCE config
```

### New pages and components (Phase 3-4)

```
app/[locale]/live/**
app/[locale]/replay/**
app/[locale]/api/f1tv/**
components/live/**
lib/live-timing/recording/**
```

---

## Success Criteria

- [x] Phase 1: SignalR client connects and receives all 17+ data topics (verified with Shanghai Sprint Qualifying — 14 topics, 500+ messages in 10s)
- [x] Phase 1: F1TV auth validates subscriptionToken JWT from browser cookie
- [x] Phase 2: Live timing works identically with `LIVE_TIMING_SOURCE=signalr` (no UI changes)
- [x] Phase 2: Automatic fallback to F1MV if SignalR fails
- [x] Phase 3: DASH/HLS video playback of replays (dashjs + hls.js with auto-detection)
- [x] Phase 3: Multi-camera switching (WIF, onboard, pit lane, data, tracker)
- [x] Phase 3: Two-level content browser (meetings → sessions → player)
- [x] Phase 3: Automated login via Playwright (pnpm f1tv:login reads email/password from env)
- [x] Phase 4: Record and replay complete sessions with timeline scrubber
- [x] All phases: Zero regressions on existing features (build verified)

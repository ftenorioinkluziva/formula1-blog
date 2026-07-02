# F1TV Live Timing Production Runbook

This project runs F1TV video and F1 live timing through a small set of production-specific network workarounds.

## Current Architecture

- Main app: Docker container `f1_blog`, served by Nginx Proxy Manager at `https://f1.blackboxinovacao.com.br`.
- NPM upstream: `f1_blog:3000` on Docker network `npm_default`.
- F1TV MPD playback: the app fetches signed MPD URLs through the regional MPD proxy, strips HEVC/H.265 adaptation sets, and rewrites DASH media segments through the CORS segment proxy.
- F1 SignalR: the app connects to `SIGNALR_HUB_URL`, currently `https://f1tv-proxy.blackboxinovacao.com.br/signalrcore`.
- F1TV proxy: `https://f1tv-proxy.blackboxinovacao.com.br/*` serves SignalR, F1TV auth/play, MPD fetches, and DASH media segments.

## Problems Solved

| Problem | Root Cause | Fix |
| --- | --- | --- |
| `404` on `/pt/admin/multimedia/galleries` | NPM pointed to old container `f1-blog` instead of new `f1_blog` | Updated upstream to `f1_blog:3000`, connected container to `npm_default`, removed old container |
| MPD API `400` | Signed CDN host was not allowlisted | Added `f1prodlive.akamaized.net` and `f1prodlive-cf.akamaized.net` |
| MPD API `403` / `302` fallback | Server-side fetch from the app host was blocked upstream; redirecting the browser to the original MPD made dash.js consume HEVC directly | Fetch the MPD through `F1TV_MPD_PROXY_URL`; never rely on the browser redirect fallback for DASH-WV playback |
| Black video with successful segment downloads | Browser received `segment__SDR-HD_HEVC_*` video segments | Next.js MPD patch removes HEVC/H.265 adaptation sets so dash.js selects AVC/H.264 |
| DASH segment CORS failures | dash.js requested Akamai media segments directly and Akamai omitted CORS headers | Rewrite MPD segment URLs through `F1TV_SEGMENT_PROXY_URL` |
| Segment proxy requests stuck at status `0` | CSP `connect-src` did not allow `f1tv-proxy.blackboxinovacao.com.br` | Add the proxy host to `connect-src` in `next.config.mjs` |
| SignalR `403` | CloudFront blocked Hetzner IP for `livetiming.formula1.com` | Route SignalR through Cloudflare Worker |
| SignalR proxy `404` | Existing proxy only handled REST routes | Added Worker route for `/signalrcore/*` |

## Environment

Production `.env.production` must include:

```bash
LIVE_TIMING_SOURCE=signalr
SIGNALR_HUB_URL=https://f1tv-proxy.blackboxinovacao.com.br/signalrcore
F1TV_MPD_PROXY_URL=https://f1tv-proxy.blackboxinovacao.com.br/f1tv/mpd
F1TV_SEGMENT_PROXY_URL=https://f1tv-proxy.blackboxinovacao.com.br/f1tv/segment
F1TV_AUDIO_PROXY_URL=https://f1tv-proxy.blackboxinovacao.com.br/f1tv/audio
F1TV_PROXY_SECRET=<shared proxy secret>
F1TV_TOKEN=<login-session cookie value>
```

Optional F1TV REST/auth proxy settings remain supported:

```bash
F1TV_PROXY_URL=
F1TV_PROXY_AUTH_URL=
```

## F1TV Proxy Routes

The proxy at `https://f1tv-proxy.blackboxinovacao.com.br` must expose:

- `GET /health`
- `/signalrcore/*`
- `POST /f1tv/auth` with `x-f1tv-proxy-secret`
- `POST /f1tv/play` with `x-f1tv-proxy-secret`
- `POST /f1tv/mpd` with `x-f1tv-proxy-secret`, body `{ "url": "<signed MPD URL>" }`, response `{ "mpd": "<MPD XML>", "finalUrl": "<final MPD URL>" }`
- `GET|HEAD|OPTIONS /f1tv/segment?url=<encoded segment URL>`, public but restricted to HTTPS and allowlisted F1TV/Akamai hosts
- `GET /f1tv/audio?url=<encoded livetiming MP3 URL>`, restricted to HTTPS and `livetiming.formula1.com`, for Team Radio transcription fallback

The segment endpoint is intentionally public because dash.js does not send `x-f1tv-proxy-secret` for media segment requests.

## CSP Requirements

`next.config.mjs` must allow the proxy in `connect-src`:

```text
connect-src ... https://f1tv-proxy.blackboxinovacao.com.br ...
```

## Validation

Health check:

```bash
curl -i https://f1tv-proxy.blackboxinovacao.com.br/health
```

F1TV auth proxy:

```bash
curl -i -X POST "https://f1tv-proxy.blackboxinovacao.com.br/f1tv/auth" \
  -H "Content-Type: application/json" \
  -H "x-f1tv-proxy-secret: $F1TV_PROXY_SECRET" \
  -d '{"email":"'"$F1TV_EMAIL"'","password":"'"$F1TV_PASSWORD"'","apiKey":"<api key from F1TV config>"}'
```

MPD proxy:

```bash
curl -i -X POST "https://f1tv-proxy.blackboxinovacao.com.br/f1tv/mpd" \
  -H "Content-Type: application/json" \
  -H "x-f1tv-proxy-secret: $F1TV_PROXY_SECRET" \
  -d '{"url":"<signed MPD URL>"}'
```

Expected result: `200` JSON with an `mpd` field containing `<MPD`.

Segment proxy preflight:

```bash
curl -i -X OPTIONS "https://f1tv-proxy.blackboxinovacao.com.br/f1tv/segment"
```

Expected result: `204` with `Access-Control-Allow-Origin: *`.

SignalR negotiate:

```bash
curl -i -X POST "https://f1tv-proxy.blackboxinovacao.com.br/signalrcore/negotiate?negotiateVersion=1" \
  -H "Authorization: Bearer $F1TV_TOKEN"
```

Expected result: JSON from the F1 SignalR negotiate endpoint, not `Cannot POST`.

App status:

```bash
curl -s https://f1.blackboxinovacao.com.br/en/api/f1tv/status
```

Healthy SignalR state:

```json
{
  "signalR": {
    "connected": true,
    "bridgeActive": true,
    "connectionState": "Connected"
  }
}
```

Known-good production evidence after the fix:

```text
Network:
GET /en/api/f1tv/mpd?...                                200 application/dash+xml
GET https://f1tv-proxy.../f1tv/segment?url=...AVC...   200 or 206
POST /en/api/f1tv/license?...                           200

MPD:
contains f1tv-proxy.blackboxinovacao.com.br/f1tv/segment
does not contain HEVC/hvc1/hev1 adaptation sets
```

## Operational Notes

- Do not recreate an old `f1-blog` container; the canonical container name is `f1_blog`.
- The GitHub Actions Hetzner deploy starts `f1_blog` directly on `npm_default` and validates the gallery admin route publicly.
- If the app returns a cached `404` after deploy, check NPM upstream and Docker network membership before debugging Next.js routes.
- Restart `f1_blog` after changing `.env.production` so proxy URLs and `SIGNALR_HUB_URL` are reloaded.
- If segments show `status 0` in DevTools, check CSP before debugging the proxy.
- If video segments show `HEVC`, the MPD was not patched by `/api/f1tv/mpd`.

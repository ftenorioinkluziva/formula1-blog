# F1TV Proxy Worker

Cloudflare Worker used by the main F1 app to reach F1 live timing from an allowed network path.

## Routes

- `GET /health` returns `{ "ok": true }`.
- `/signalrcore/*` proxies all methods to `https://livetiming.formula1.com/signalrcore/*`.
- `GET|HEAD|OPTIONS /f1tv/audio?url=<encoded livetiming MP3 URL>` proxies Team Radio MP3 files for transcription.
- `POST /f1tv/auth` authenticates against the F1 account API and returns `subscriptionToken` + `rawCookieValue`.
- `POST /f1tv/play` fetches F1TV content play URLs.

The proxy preserves request headers where needed and adds browser-like `Origin`, `Referer`, and `User-Agent` headers. The Team Radio audio route is restricted to HTTPS URLs on `livetiming.formula1.com/static/.../TeamRadio/*.mp3`.

## Deploy

```bash
npx wrangler deploy
```

The custom route is configured in `wrangler.toml`:

```text
f1tv-proxy.blackboxinovacao.com.br/*
```

## Test

```bash
curl -i https://f1tv-proxy.blackboxinovacao.com.br/health

curl -i -X POST "https://f1tv-proxy.blackboxinovacao.com.br/signalrcore/negotiate?negotiateVersion=1" \
  -H "Authorization: Bearer $F1TV_TOKEN"

curl -i -X POST "https://f1tv-proxy.blackboxinovacao.com.br/f1tv/auth" \
  -H "Content-Type: application/json" \
  -H "x-f1tv-proxy-secret: $F1TV_PROXY_SECRET" \
  -d '{"email":"'"$F1TV_EMAIL"'","password":"'"$F1TV_PASSWORD"'","apiKey":"'"$F1TV_API_KEY"'"}'

curl -I "https://f1tv-proxy.blackboxinovacao.com.br/f1tv/audio?url=https%3A%2F%2Flivetiming.formula1.com%2Fstatic%2F2026%2F2026-06-07_Monaco_Grand_Prix%2F2026-06-07_Race%2FTeamRadio%2FLAW_30_20260607_142803.mp3"
```

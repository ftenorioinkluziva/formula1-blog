# F1TV + Live Timing Local Runbook

This application is intended to run on a local machine with Docker Compose.

## Architecture

- Main dev app: Docker container `f1blog_dev_app`, exposed at `http://localhost:3010`.
- Database: Docker container `f1blog_dev_postgres`, exposed at `localhost:5432`.
- Live Timing: server-side SignalR connection to `SIGNALR_HUB_URL` or the default F1 endpoint.
- F1TV playback: app routes fetch entitlement, MPD, license, and media metadata. Optional proxy URLs remain supported for machines that need regional routing.

## Start

```bash
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec f1_blog pnpm db:migrate
docker compose -f docker-compose.dev.yml exec f1_blog pnpm db:seed
```

Open:

```text
http://localhost:3010
```

Optional Telegram bot:

```bash
docker compose -f docker-compose.dev.yml --profile bot up -d --build
```

Optional local workers:

```bash
docker compose -f docker-compose.dev.yml --profile workers up -d --build
```

## Environment

Local `.env.local` should use the Compose Postgres host:

```bash
DATABASE_URL=postgresql://f1blog_user:vA29HAUabVbIVs15OpqhAVXKNvaDqk7B@postgres:5432/f1blog?sslmode=disable
AUTO_CONNECT_ENABLED=1
```

Optional F1TV settings:

```bash
F1TV_EMAIL=
F1TV_PASSWORD=
F1TV_TOKEN=
F1TV_AUTO_RENEW_ENABLED=0
SIGNALR_HUB_URL=
F1TV_PROXY_URL=
F1TV_MPD_PROXY_URL=
F1TV_SEGMENT_PROXY_URL=
F1TV_AUDIO_PROXY_URL=
F1TV_PROXY_SECRET=
```

Leave proxy variables blank for direct local use. Set them only when this local network needs a proxy for F1TV playback or SignalR.

## Validation

App health/status:

```bash
curl.exe -i http://localhost:3010/en/api/f1tv/status
```

Expected config excerpt:

```json
{
  "config": {
    "source": "signalr",
    "autoConnectEnabled": true
  }
}
```

Live Timing snapshot:

```bash
curl.exe -i http://localhost:3010/en/api/live-timing
```

During periods without an active/upcoming F1 session, the snapshot can be unavailable. That is expected.

## Operations

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f f1_blog
docker compose -f docker-compose.dev.yml restart f1_blog
docker compose -f docker-compose.dev.yml down
```

## Docker Modes

Use `docker-compose.dev.yml` for normal local development. It runs `pnpm dev`, bind-mounts the source tree, and keeps `node_modules` plus `.next` in Docker volumes.

On the first run, the app container initializes the `node_modules` volume with `pnpm install --frozen-lockfile`. Later starts reuse the volume and should not run a production `next build`.

Use `docker-compose.yml` only when you explicitly want to test the standalone production image locally. That path runs `next build`.

## Standalone Build Notes

The Dockerfile limits the Next.js build worker count in the `builder` stage:

```dockerfile
ARG NEXT_BUILD_WORKER_COUNT=2
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=${NEXT_BUILD_WORKER_COUNT}
ENV NODE_OPTIONS="--max-old-space-size=3072"
```

This is intentional for local Docker Desktop usage. It trades some build parallelism for lower memory/CPU spikes and helps avoid BuildKit failures such as `failed to receive status: rpc error: code = Unavailable desc = error reading from server: EOF`.

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile

FROM deps AS bot
WORKDIR /app

COPY . .

CMD ["pnpm", "bot:telegram"]

FROM deps AS dev
WORKDIR /app

COPY . .

CMD ["pnpm", "dev", "--webpack", "--hostname", "0.0.0.0"]

FROM dev AS worker
WORKDIR /app

# Install system deps needed by Playwright browsers (not full Chromium via apt)
RUN npx playwright install --with-deps chromium 2>&1

ENV CHROME_BINARY="/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome"

CMD ["pnpm", "exec", "tsx", "scripts/run-workers.ts"]

FROM base AS builder
WORKDIR /app

ARG NEXT_BUILD_WORKER_COUNT=2
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=${NEXT_BUILD_WORKER_COUNT}
ENV NODE_OPTIONS="--max-old-space-size=3072"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build --webpack

# @microsoft/signalr uses dynamic require("eventsource") at runtime;
# @vercel/nft tracing doesn't catch it, so copy manually into standalone output
RUN cp -r node_modules/.pnpm/eventsource@2.0.2 .next/standalone/node_modules/.pnpm/eventsource@2.0.2

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
RUN mkdir -p /app/data/recordings && chown -R nextjs:nodejs /app/data

COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

RUN ln -s /app/node_modules/.pnpm/ws@8.20.0/node_modules/ws /app/node_modules/ws
RUN ln -s /app/node_modules/.pnpm/eventsource@2.0.2/node_modules/eventsource /app/node_modules/eventsource

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/data/recordings && chown -R nextjs:nodejs /app/data && exec su nextjs -s /bin/sh -c 'node server.js'"]

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --network-concurrency=1 --child-concurrency=1

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

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_BINARY=/usr/bin/chromium

CMD ["pnpm", "exec", "tsx", "scripts/run-workers.ts"]

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build --webpack

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


USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

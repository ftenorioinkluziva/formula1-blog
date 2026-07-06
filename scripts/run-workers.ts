import { spawn } from "node:child_process"
import Module from "node:module"
import { fileURLToPath } from "node:url"

const serverOnlyShim = fileURLToPath(new URL("./server-only-shim.cjs", import.meta.url))
const originalResolveFilename = (
  Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: unknown,
      isMain: boolean,
      options?: unknown,
    ) => string
  }
)._resolveFilename

;(Module as typeof Module & { _resolveFilename: typeof originalResolveFilename })._resolveFilename = (
  request,
  parent,
  isMain,
  options,
) => {
  if (request === "server-only") {
    return serverOnlyShim
  }

  return originalResolveFilename(request, parent, isMain, options)
}

function numericEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function startPhotoSyncScheduler() {
  const maxGalleries = numericEnv("PHOTO_SYNC_MAX_GALLERIES", 20)
  const photoDays = numericEnv("PHOTO_SYNC_DAYS", 60)
  const historyDays = numericEnv("PHOTO_SYNC_HISTORY_DAYS", 60)
  const windowHours = numericEnv("PHOTO_SYNC_WINDOW_HOURS", 1440)

  const child = spawn(
    "pnpm",
    [
      "db:session-scheduler",
      "--fotos",
      "--photo-history-days",
      String(historyDays),
      "--photo-days",
      String(photoDays),
      "--photos-window-hours",
      String(windowHours),
      "--photo-max-galleries",
      String(maxGalleries),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "inherit",
    },
  )

  child.unref()
  console.log(`[workers] Photo sync scheduler started (max galleries: ${maxGalleries})`)
}

function startTopicScheduler() {
  const topicDelayMinutes = numericEnv("TOPIC_SYNC_DELAY_MINUTES", 60)
  const topicRetryMinutes = numericEnv("TOPIC_SYNC_RETRY_MINUTES", 30)
  const topicWindowHours = numericEnv("TOPIC_SYNC_WINDOW_HOURS", 6)
  const topicMaxAttempts = numericEnv("TOPIC_SYNC_MAX_ATTEMPTS", 3)

  const child = spawn(
    "pnpm",
    [
      "db:session-scheduler",
      "--topics",
      "--topic-delay-minutes",
      String(topicDelayMinutes),
      "--topic-retry-minutes",
      String(topicRetryMinutes),
      "--topic-window-hours",
      String(topicWindowHours),
      "--topic-max-attempts",
      String(topicMaxAttempts),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "inherit",
    },
  )

  child.unref()
  console.log(`[workers] Topic scheduler started (delay: ${topicDelayMinutes}min, retry: ${topicRetryMinutes}min)`)
}

async function main() {
  console.log("[workers] Starting local background workers")

  if (process.env.F1TV_AUTO_RENEW_ENABLED !== "0") {
    const { startF1TVAutoRenewalScheduler } = await import("../lib/f1tv/auto-renewal-scheduler")
    startF1TVAutoRenewalScheduler()
  }

  if (process.env.AUTO_CONNECT_ENABLED === "1") {
    const { startScheduler } = await import("../lib/live-timing/scheduler")
    startScheduler()
  }

  if (process.env.AUTO_POST_ROUND_ENABLED === "1") {
    const { startFantasyPostRoundAutomation } = await import("../lib/fantasy/post-round-automation")
    startFantasyPostRoundAutomation()
  }

  if (process.env.AUTO_PHOTO_SYNC_ENABLED !== "0") {
    const delayMs = numericEnv("PHOTO_SYNC_START_DELAY_MS", 0)

    if (delayMs > 0) {
      console.log(`[workers] Photo sync scheduler scheduled in ${Math.round(delayMs / 1000)}s`)
      setTimeout(startPhotoSyncScheduler, delayMs)
    } else {
      startPhotoSyncScheduler()
    }
  }

  if (process.env.AUTO_TOPIC_SYNC_ENABLED !== "0") {
    const delayMs = numericEnv("TOPIC_SYNC_START_DELAY_MS", 30_000)

    if (delayMs > 0) {
      console.log(`[workers] Topic scheduler scheduled in ${Math.round(delayMs / 1000)}s`)
      setTimeout(startTopicScheduler, delayMs)
    } else {
      startTopicScheduler()
    }
  }

  setInterval(() => {
    // Keep the worker process alive for interval-based schedulers.
  }, 60 * 60 * 1000)
}

main().catch((err) => {
  console.error("[workers] Failed to start:", err)
  process.exit(1)
})

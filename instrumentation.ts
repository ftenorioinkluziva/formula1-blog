import { spawn } from "node:child_process"

export async function register() {
  const isEdgeRuntime = typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined"
  if (isEdgeRuntime) {
    return
  }

  await loadF1TVToken()

  if (process.env.F1TV_AUTO_RENEW_ENABLED !== "0") {
    const { startF1TVAutoRenewalScheduler } = await import("@/lib/f1tv/auto-renewal-scheduler")
    startF1TVAutoRenewalScheduler()
  }

  if (process.env.AUTO_CONNECT_ENABLED === "1") {
    const { startScheduler } = await import("@/lib/live-timing/scheduler")
    startScheduler()
  }

  if (process.env.AUTO_PHOTO_SYNC_ENABLED !== "0") {
    startPhotoSyncScheduler()
  }

  if (process.env.AUTO_POST_ROUND_ENABLED === "1") {
    const { startFantasyPostRoundAutomation } = await import("@/lib/fantasy/post-round-automation")
    startFantasyPostRoundAutomation()
  }
}

function startPhotoSyncScheduler() {
  const globalState = globalThis as typeof globalThis & { __photoSyncSchedulerStarted?: boolean }
  if (globalState.__photoSyncSchedulerStarted) {
    return
  }
  globalState.__photoSyncSchedulerStarted = true

  const child = spawn(
    "pnpm",
    [
      "db:session-scheduler",
      "--fotos",
      "--photo-history-days",
      "60",
      "--photo-days",
      "60",
      "--photos-window-hours",
      "1440",
      "--photo-max-galleries",
      "20",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "ignore",
    },
  )

  child.unref()
  console.log("[instrumentation] Photo sync scheduler started")
}

async function loadF1TVToken() {
  // Priority: env var → Redis (allows runtime update without restart)
  const envToken = process.env.F1TV_TOKEN
  if (envToken) {
    try {
      const { setTokenDirectly } = await import("@/lib/f1tv/auth")
      setTokenDirectly(envToken)
      console.log("[instrumentation] F1TV token loaded from env")
      return
    } catch (err) {
      console.warn("[instrumentation] F1TV env token invalid:", err instanceof Error ? err.message : err)
    }
  }

  try {
    const { loadTokenFromRedis } = await import("@/lib/f1tv/token-store")
    const { setTokenDirectly } = await import("@/lib/f1tv/auth")
    const token = await loadTokenFromRedis()
    if (token) {
      setTokenDirectly(token)
      console.log("[instrumentation] F1TV token loaded from Redis")
    } else {
      console.warn("[instrumentation] No F1TV token found — visit /admin/f1tv to authenticate")
    }
  } catch (err) {
    console.warn("[instrumentation] Failed to load F1TV token from Redis:", err instanceof Error ? err.message : err)
  }
}

export async function register() {
  const isEdgeRuntime = typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined"
  if (isEdgeRuntime) {
    return
  }

  await loadF1TVToken()

  if (process.env.INSTRUMENTATION_WORKERS_ENABLED === "0") {
    console.log("[instrumentation] Background workers disabled for this process")
    return
  }

  startBackgroundWorkers()
}

function startBackgroundWorkers(): void {
  if (process.env.F1TV_AUTO_RENEW_ENABLED !== "0") {
    void startWorker("f1tv auto-renewal", async () => {
      const { startF1TVAutoRenewalScheduler } =
        await importRuntime<typeof import("@/lib/f1tv/auto-renewal-scheduler")>(
          "@/lib/f1tv/auto-renewal-scheduler",
        )
      startF1TVAutoRenewalScheduler()
    })
  }

  if (process.env.AUTO_CONNECT_ENABLED === "1") {
    void startWorker("live timing scheduler", async () => {
      const { startScheduler } =
        await importRuntime<typeof import("@/lib/live-timing/scheduler")>("@/lib/live-timing/scheduler")
      startScheduler()
    })
  }

  if (process.env.AUTO_PHOTO_SYNC_ENABLED !== "0") {
    void startWorker("photo sync scheduler", startPhotoSyncScheduler)
  }

  if (process.env.AUTO_POST_ROUND_ENABLED === "1") {
    void startWorker("fantasy post-round automation", async () => {
      const { startFantasyPostRoundAutomation } =
        await importRuntime<typeof import("@/lib/fantasy/post-round-automation")>(
          "@/lib/fantasy/post-round-automation",
        )
      startFantasyPostRoundAutomation()
    })
  }
}

async function importRuntime<T>(specifier: string): Promise<T> {
  const importer = new Function("specifier", "return import(specifier)") as (value: string) => Promise<T>
  return importer(specifier)
}

async function startWorker(name: string, start: () => Promise<void>): Promise<void> {
  setTimeout(() => {
    start().catch((err) => {
      console.warn(
        `[instrumentation] ${name} failed to start:`,
        err instanceof Error ? err.message : err,
      )
    })
  }, 0)
}

async function startPhotoSyncScheduler() {
  const globalState = globalThis as typeof globalThis & { __photoSyncSchedulerStarted?: boolean }
  if (globalState.__photoSyncSchedulerStarted) {
    return
  }
  globalState.__photoSyncSchedulerStarted = true

  const { spawn } = await importRuntime<typeof import("node:child_process")>("node:child_process")

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

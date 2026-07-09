import "server-only"

import { getRedisClient } from "@/lib/cache/redis"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends, userProfiles } from "@/lib/db/schema"
import { loginWithEnvCredentials, loginWithDbCredentials } from "@/lib/f1tv/credentials-login"
import { and, asc, eq, gt, inArray, ne, or, isNotNull } from "drizzle-orm"

const RENEWAL_LEAD_MS = 24 * 60 * 60 * 1000
const RETRY_INTERVAL_MS = 60 * 60 * 1000
const RENEWAL_MARK_TTL_SECONDS = 14 * 24 * 60 * 60
const PRACTICE_1_TYPES = ["Practice 1", "Pratice 1"]
const PRACTICE_1_CODES = ["P1", "FP1"]
const MAX_TIMEOUT_MS = 2_147_483_647

interface RenewalState {
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  renewing: boolean
  lastCheck: string | null
  lastRenewedSessionId: number | null
  nextRunAt: string | null
  lastError: string | null
}

const state: RenewalState = {
  timer: null,
  running: false,
  renewing: false,
  lastCheck: null,
  lastRenewedSessionId: null,
  nextRunAt: null,
  lastError: null,
}

interface Practice1Session {
  id: number
  sessionType: string
  sessionCode: string
  startTimeUtc: Date
  grandPrixName: string
}

interface RenewalAttemptState {
  status: "pending" | "failed" | "success"
  attemptCount: number
  lastAttemptAtIso: string | null
  nextAttemptAtIso: string | null
  renewedAtIso: string | null
  lastError: string | null
}

const localAttemptStore = new Map<number, RenewalAttemptState>()

function getDueAt(session: Practice1Session): Date {
  return new Date(session.startTimeUtc.getTime() - RENEWAL_LEAD_MS)
}

function emptyAttemptState(): RenewalAttemptState {
  return {
    status: "pending",
    attemptCount: 0,
    lastAttemptAtIso: null,
    nextAttemptAtIso: null,
    renewedAtIso: null,
    lastError: null,
  }
}

function attemptStateKey(sessionId: number): string {
  return `f1tv:auto-renewal:v2:${sessionId}`
}

async function findNextPractice1Session(): Promise<Practice1Session | null> {
  const db = getDb()
  if (!db) return null

  const now = new Date()

  const [session] = await db
    .select({
      id: raceSessions.id,
      sessionType: raceSessions.sessionType,
      sessionCode: raceSessions.sessionCode,
      startTimeUtc: raceSessions.startTimeUtc,
      grandPrixName: raceWeekends.grandPrixName,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        gt(raceSessions.startTimeUtc, now),
        ne(raceSessions.status, "cancelled"),
        or(
          inArray(raceSessions.sessionType, PRACTICE_1_TYPES),
          inArray(raceSessions.sessionCode, PRACTICE_1_CODES),
        ),
      ),
    )
    .orderBy(asc(raceSessions.startTimeUtc))
    .limit(1)

  return session ?? null
}

async function loadAttemptState(sessionId: number): Promise<RenewalAttemptState> {
  const localState = localAttemptStore.get(sessionId)
  if (localState) return localState

  const redis = await getRedisClient()
  if (!redis) return emptyAttemptState()

  try {
    const rawValue = await redis.get(attemptStateKey(sessionId))
    if (!rawValue) return emptyAttemptState()
    return JSON.parse(rawValue) as RenewalAttemptState
  } catch {
    return emptyAttemptState()
  }
}

async function saveAttemptState(
  sessionId: number,
  attemptState: RenewalAttemptState,
): Promise<void> {
  localAttemptStore.set(sessionId, attemptState)

  const redis = await getRedisClient()
  if (!redis) return

  try {
    await redis.set(attemptStateKey(sessionId), JSON.stringify(attemptState), {
      EX: RENEWAL_MARK_TTL_SECONDS,
    })
  } catch {
    // local state is enough until process restart
  }
}

function getNextAttemptAt(
  session: Practice1Session,
  attemptState: RenewalAttemptState,
): Date {
  if (attemptState.nextAttemptAtIso) {
    return new Date(attemptState.nextAttemptAtIso)
  }

  return getDueAt(session)
}

async function scheduleNextCheck(delayMs: number): Promise<void> {
  if (!state.running) return

  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
  }

  const safeDelayMs = Math.max(1_000, Math.min(delayMs, MAX_TIMEOUT_MS))
  state.nextRunAt = new Date(Date.now() + safeDelayMs).toISOString()

  state.timer = setTimeout(() => {
    check().catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err)
      console.error("[f1tv/auto-renewal] Check failed:", err)
      void scheduleNextCheck(RETRY_INTERVAL_MS)
    })
  }, safeDelayMs)
}

function loginWithSubprocess(email: string, password: string): Promise<void> {
  const fs = require("fs")
  const path = require("path")
  const { spawn } = require("child_process")

  const cwd = typeof process !== "undefined" && typeof (process as any)["cwd"] === "function"
    ? (process as any)["cwd"]()
    : ""
  const scriptPath = path.join(cwd, "scripts/f1tv-login.ts")
  if (!fs.existsSync(scriptPath)) {
    console.warn(`[f1tv/auto-renewal] scripts/f1tv-login.ts not found. Subprocess login skipped.`)
    return Promise.reject(new Error("Headless login script not available on this container (delegate to worker)"))
  }

  return new Promise<void>((resolve, reject) => {
    console.log(`[f1tv/auto-renewal] Spawning headless Playwright login process for ${email}...`)
    
    const child = spawn("npx", ["tsx", "scripts/f1tv-login.ts", "--headless"], {
      shell: true,
      env: {
        ...process.env,
        F1TV_EMAIL: email,
        F1TV_PASSWORD: password,
        HEADLESS: "true",
        NPM_CONFIG_CACHE: "/tmp/.npm-cache",
      },
    })
    
    let stdout = ""
    let stderr = ""
    
    child.stdout?.on("data", (data: any) => {
      stdout += data.toString()
    })
    
    child.stderr?.on("data", (data: any) => {
      stderr += data.toString()
    })
    
    child.on("close", (code: number) => {
      if (code === 0) {
        console.log("[f1tv/auto-renewal] Headless Playwright login subprocess completed successfully!")
        resolve()
      } else {
        console.error(`[f1tv/auto-renewal] Subprocess failed with exit code ${code}`)
        console.error(`Stdout: ${stdout}`)
        console.error(`Stderr: ${stderr}`)
        reject(new Error(`Playwright login subprocess failed: ${stderr || stdout}`))
      }
    })
    
    child.on("error", (err: any) => {
      console.error("[f1tv/auto-renewal] Failed to start Playwright login subprocess:", err)
      reject(err)
    })
  })
}

async function check(): Promise<void> {
  if (state.renewing) return

  state.lastCheck = new Date().toISOString()
  state.lastError = null

  const hasEnv = Boolean(process.env.F1TV_EMAIL && process.env.F1TV_PASSWORD)
  let hasDb = false
  const db = getDb()
  if (db) {
    try {
      const [adminProfile] = await db
        .select({ id: userProfiles.userId })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.role, "admin"),
            isNotNull(userProfiles.f1tvEmail),
            isNotNull(userProfiles.f1tvPassword)
          )
        )
        .limit(1)
      hasDb = !!adminProfile
    } catch {
      hasDb = false
    }
  }

  if (!hasEnv && !hasDb) {
    state.lastError = "No F1TV credentials configured (either in DB or env)"
    await scheduleNextCheck(RETRY_INTERVAL_MS)
    return
  }

  const session = await findNextPractice1Session()
  if (!session) {
    await scheduleNextCheck(RETRY_INTERVAL_MS)
    return
  }

  const attemptState = await loadAttemptState(session.id)
  if (attemptState.status === "success") {
    state.lastRenewedSessionId = session.id
    await scheduleNextCheck(RETRY_INTERVAL_MS)
    return
  }

  const now = new Date()
  const nextAttemptAt = getNextAttemptAt(session, attemptState)
  if (now < nextAttemptAt) {
    await scheduleNextCheck(nextAttemptAt.getTime() - now.getTime())
    return
  }

  state.renewing = true
  try {
    console.log(
      `[f1tv/auto-renewal] Attempt ${attemptState.attemptCount + 1} for ${session.grandPrixName} ${session.sessionType}; scheduled at ${nextAttemptAt.toISOString()}`,
    )

    let loginResult: any = null
    let credentials: { email: string; password?: string } | null = null

    // Load active DB admin credentials
    if (db) {
      try {
        const [adminProfile] = await db
          .select({
            f1tvEmail: userProfiles.f1tvEmail,
            f1tvPassword: userProfiles.f1tvPassword,
          })
          .from(userProfiles)
          .where(
            and(
              eq(userProfiles.role, "admin"),
              isNotNull(userProfiles.f1tvEmail),
              isNotNull(userProfiles.f1tvPassword)
            )
          )
          .limit(1)

        if (adminProfile?.f1tvEmail && adminProfile?.f1tvPassword) {
          const { decryptPassword } = await import("./crypto")
          credentials = {
            email: adminProfile.f1tvEmail,
            password: decryptPassword(adminProfile.f1tvPassword),
          }
        }
      } catch (dbErr) {
        console.warn("[f1tv/auto-renewal] Failed to load credentials from DB:", dbErr)
      }
    }

    if (!credentials && process.env.F1TV_EMAIL && process.env.F1TV_PASSWORD) {
      console.log("[f1tv/auto-renewal] Falling back to env credentials")
      credentials = {
        email: process.env.F1TV_EMAIL,
        password: process.env.F1TV_PASSWORD,
      }
    }

    if (!credentials) {
      throw new Error("No F1TV credentials configured")
    }

    try {
      const { loginWithF1TVCredentials } = await import("./credentials-login")
      loginResult = await loginWithF1TVCredentials(credentials.email, credentials.password!)
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      const isWafBlock = errMsg.includes("403") || errMsg.includes("Forbidden") || errMsg.includes("non-JSON (403)")
      
      if (isWafBlock) {
        console.log("[f1tv/auto-renewal] Direct API login blocked by WAF. Attempting Playwright headless login subprocess...")
        await loginWithSubprocess(credentials.email, credentials.password!)
        
        const { loadTokenFromRedis } = await import("./token-store")
        const token = await loadTokenFromRedis()
        if (!token) {
          throw new Error("Subprocess completed but token was not found in Redis")
        }
        
        const { setTokenDirectly } = await import("./auth")
        setTokenDirectly(token)
        
        loginResult = {
          rawCookieValue: token,
          expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000), // Approx 13 days
        }
      } else {
        throw err
      }
    }

    const { activateAndPersistToken } = await import("@/lib/f1tv/token-persistence")
    const { persistedEnv, persistedRedis } = await activateAndPersistToken(
      loginResult.rawCookieValue,
    )
    const renewedState: RenewalAttemptState = {
      status: "success",
      attemptCount: attemptState.attemptCount + 1,
      lastAttemptAtIso: new Date().toISOString(),
      nextAttemptAtIso: null,
      renewedAtIso: new Date().toISOString(),
      lastError: null,
    }
    await saveAttemptState(session.id, renewedState)
    state.lastRenewedSessionId = session.id

    console.log(
      `[f1tv/auto-renewal] Token renewed for session ${session.id}; expires ${loginResult.expiresAt.toISOString() || "N/A"}; persisted env=${persistedEnv} redis=${persistedRedis}`,
    )
    await scheduleNextCheck(RETRY_INTERVAL_MS)
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err)
    const failedAt = new Date()
    const retryAt = new Date(failedAt.getTime() + RETRY_INTERVAL_MS)
    const nextAttemptAt =
      retryAt < session.startTimeUtc ? retryAt : session.startTimeUtc
    await saveAttemptState(session.id, {
      status: "failed",
      attemptCount: attemptState.attemptCount + 1,
      lastAttemptAtIso: failedAt.toISOString(),
      nextAttemptAtIso: nextAttemptAt.toISOString(),
      renewedAtIso: null,
      lastError: state.lastError,
    })
    console.error("[f1tv/auto-renewal] Renewal failed:", err)
    await scheduleNextCheck(nextAttemptAt.getTime() - Date.now())
  } finally {
    state.renewing = false
  }
}

let forceLoginTimer: ReturnType<typeof setInterval> | null = null

function startForceLoginPolling() {
  const fs = require("fs")
  const path = require("path")
  const cwd = typeof process !== "undefined" && typeof (process as any)["cwd"] === "function"
    ? (process as any)["cwd"]()
    : ""
  const scriptPath = path.join(cwd, "scripts/f1tv-login.ts")
  if (!fs.existsSync(scriptPath)) {
    console.log("[f1tv/auto-renewal] scripts/f1tv-login.ts not found. Force login polling disabled on this container.")
    return
  }

  if (forceLoginTimer) return

  forceLoginTimer = setInterval(async () => {
    try {
      const redis = await getRedisClient()
      if (!redis) return

      const forceRequest = await redis.get("f1tv:force-login-request")
      if (forceRequest === "true") {
        console.log("[f1tv/auto-renewal] Force login request detected in Redis. Running Playwright subprocess...")
        await redis.del("f1tv:force-login-request")

        const db = getDb()
        let credentials: { email: string; password?: string } | null = null

        if (db) {
          try {
            const [adminProfile] = await db
              .select({
                f1tvEmail: userProfiles.f1tvEmail,
                f1tvPassword: userProfiles.f1tvPassword,
              })
              .from(userProfiles)
              .where(
                and(
                  eq(userProfiles.role, "admin"),
                  isNotNull(userProfiles.f1tvEmail),
                  isNotNull(userProfiles.f1tvPassword)
                )
              )
              .limit(1)

            if (adminProfile?.f1tvEmail && adminProfile?.f1tvPassword) {
              const { decryptPassword } = await import("./crypto")
              credentials = {
                email: adminProfile.f1tvEmail,
                password: decryptPassword(adminProfile.f1tvPassword),
              }
            }
          } catch (dbErr) {
            console.warn("[f1tv/auto-renewal] Force login failed to load credentials from DB:", dbErr)
          }
        }

        if (!credentials && process.env.F1TV_EMAIL && process.env.F1TV_PASSWORD) {
          credentials = {
            email: process.env.F1TV_EMAIL,
            password: process.env.F1TV_PASSWORD,
          }
        }

        if (credentials) {
          await loginWithSubprocess(credentials.email, credentials.password!)
          console.log("[f1tv/auto-renewal] Force login subprocess completed successfully.")
        } else {
          console.warn("[f1tv/auto-renewal] Force login requested, but no credentials found.")
        }
      }
    } catch (err) {
      console.error("[f1tv/auto-renewal] Error in force login polling:", err)
    }
  }, 10000) // Poll every 10 seconds
}

export function startF1TVAutoRenewalScheduler(): void {
  if (state.running) return

  state.running = true
  console.log(
    `[f1tv/auto-renewal] Started — first attempt at start_time_utc - ${RENEWAL_LEAD_MS / 60_000}min, retries every ${RETRY_INTERVAL_MS / 60_000}min`,
  )

  check().catch((err) => {
    state.lastError = err instanceof Error ? err.message : String(err)
    console.error("[f1tv/auto-renewal] Initial check failed:", err)
  })

  startForceLoginPolling()
}

export function stopF1TVAutoRenewalScheduler(): void {
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
  }
  if (forceLoginTimer) {
    clearInterval(forceLoginTimer)
    forceLoginTimer = null
  }
  state.running = false
  console.log("[f1tv/auto-renewal] Stopped")
}

export function getF1TVAutoRenewalStatus(): {
  running: boolean
  renewing: boolean
  lastCheck: string | null
  lastRenewedSessionId: number | null
  nextRunAt: string | null
  lastError: string | null
} {
  return {
    running: state.running,
    renewing: state.renewing,
    lastCheck: state.lastCheck,
    lastRenewedSessionId: state.lastRenewedSessionId,
    nextRunAt: state.nextRunAt,
    lastError: state.lastError,
  }
}

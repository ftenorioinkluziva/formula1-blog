import "server-only"

import { getRedisClient } from "@/lib/cache/redis"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import { loginWithEnvCredentials } from "@/lib/f1tv/credentials-login"
import { and, asc, eq, gt, inArray, ne, or } from "drizzle-orm"

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

async function check(): Promise<void> {
  if (state.renewing) return

  state.lastCheck = new Date().toISOString()
  state.lastError = null

  if (!process.env.F1TV_EMAIL || !process.env.F1TV_PASSWORD) {
    state.lastError = "F1TV_EMAIL and F1TV_PASSWORD are not configured"
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

    const loginResult = await loginWithEnvCredentials()
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
      `[f1tv/auto-renewal] Token renewed for session ${session.id}; expires ${loginResult.expiresAt.toISOString()}; persisted env=${persistedEnv} redis=${persistedRedis}`,
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

}

export function stopF1TVAutoRenewalScheduler(): void {
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
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

import "server-only"

import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import { and, gt, ne, asc, eq, lte } from "drizzle-orm"

const CHECK_INTERVAL_MS = 5 * 60 * 1000
const PRE_SESSION_LEAD_MS = 60 * 60 * 1000

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null
  running: boolean
  signalRActive: boolean
  currentSessionId: number | null
  lastCheck: string | null
}

const state: SchedulerState = {
  timer: null,
  running: false,
  signalRActive: false,
  currentSessionId: null,
  lastCheck: null,
}

async function findUpcomingSession(): Promise<{
  id: number
  sessionType: string
  startTimeUtc: Date
  grandPrixName: string
  minutesUntil: number
} | null> {
  const db = getDb()
  if (!db) return null

  const now = new Date()
  const windowEnd = new Date(now.getTime() + PRE_SESSION_LEAD_MS)

  const [session] = await db
    .select({
      id: raceSessions.id,
      sessionType: raceSessions.sessionType,
      startTimeUtc: raceSessions.startTimeUtc,
      endTimeUtc: raceSessions.endTimeUtc,
      status: raceSessions.status,
      grandPrixName: raceWeekends.grandPrixName,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        gt(raceSessions.endTimeUtc, now),
        lte(raceSessions.startTimeUtc, windowEnd),
        ne(raceSessions.status, "cancelled"),
      ),
    )
    .orderBy(asc(raceSessions.startTimeUtc))
    .limit(1)

  if (!session) return null

  const minutesUntil = Math.round((session.startTimeUtc.getTime() - now.getTime()) / 60_000)

  return {
    id: session.id,
    sessionType: session.sessionType,
    startTimeUtc: session.startTimeUtc,
    grandPrixName: session.grandPrixName,
    minutesUntil,
  }
}

async function activateSignalR(): Promise<void> {
  if (state.signalRActive) return

  try {
    const { initSignalRBridge, isSignalRBridgeActive } = await import(
      "@/lib/live-timing/signalr/snapshot-bridge"
    )

    if (isSignalRBridgeActive()) {
      state.signalRActive = true
      return
    }

    await initSignalRBridge()
    state.signalRActive = true

    if (process.env.RECORDING_ENABLED === "1") {
      try {
        const { startRecordingAsync, isRecording } = await import(
          "@/lib/live-timing/recording/recorder"
        )
        if (!isRecording()) {
          await startRecordingAsync()
        }
      } catch (err) {
        console.warn("[scheduler] Recording start failed:", err)
      }
    }

    console.log("[scheduler] SignalR + recording activated")
  } catch (err) {
    console.error("[scheduler] Failed to activate SignalR:", err)
  }
}

async function check(): Promise<void> {
  state.lastCheck = new Date().toISOString()

  const session = await findUpcomingSession()

  if (!session) {
    if (state.signalRActive) {
      console.log("[scheduler] No upcoming session — SignalR stays active until session ends naturally")
    }
    return
  }

  if (state.currentSessionId === session.id && state.signalRActive) return

  state.currentSessionId = session.id

  if (session.minutesUntil <= 0) {
    console.log(
      `[scheduler] ${session.grandPrixName} ${session.sessionType} is LIVE — activating`,
    )
  } else {
    console.log(
      `[scheduler] ${session.grandPrixName} ${session.sessionType} starts in ${session.minutesUntil}min — activating`,
    )
  }

  await activateSignalR()
}

export function startScheduler(): void {
  if (state.running) return
  if (process.env.AUTO_CONNECT_ENABLED !== "1") return

  state.running = true

  console.log(
    `[scheduler] Started — checking every ${CHECK_INTERVAL_MS / 60_000}min, lead time ${PRE_SESSION_LEAD_MS / 60_000}min`,
  )

  check().catch((err) =>
    console.error("[scheduler] Initial check failed:", err),
  )

  state.timer = setInterval(() => {
    check().catch((err) =>
      console.error("[scheduler] Check failed:", err),
    )
  }, CHECK_INTERVAL_MS)
}

export function stopScheduler(): void {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
  state.running = false
  console.log("[scheduler] Stopped")
}

export function getSchedulerStatus(): {
  running: boolean
  signalRActive: boolean
  currentSessionId: number | null
  lastCheck: string | null
} {
  return {
    running: state.running,
    signalRActive: state.signalRActive,
    currentSessionId: state.currentSessionId,
    lastCheck: state.lastCheck,
  }
}

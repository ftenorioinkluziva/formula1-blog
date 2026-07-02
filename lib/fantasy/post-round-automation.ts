import "server-only"

import { and, desc, eq, gt, inArray } from "drizzle-orm"
import { getRedisClient } from "@/lib/cache/redis"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends, sessionStatusEvents } from "@/lib/db/schema"
import { runFantasyPostRound } from "@/lib/fantasy/post-round-pipeline"
import { fetchRaceResults, fetchSprintResults } from "@/lib/jolpica/client"
import { resolveExternalRound } from "@/lib/jolpica/round-mapping"

const AUTOMATION_KEY_PREFIX = "fantasy:auto-post-round:v1"
const POLL_INTERVAL_MS = 5 * 60 * 1000
const FINALISED_DELAY_MS = 10 * 60 * 1000
const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000
const LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

interface AutomationState {
  sprintResultsHash: string | null
  raceResultsHash: string | null
  lastMode: "sprint_sync" | "race_post_round" | null
  lastProcessedAtIso: string | null
  lastError: string | null
  attemptCount: number
  reconcileUntilIso: string | null
}

interface PointSessionCandidate {
  sessionId: number
  season: number
  round: number
  sessionType: "Sprint" | "Race"
  endTimeUtc: Date
  finalisedAt: Date | null
}

interface RoundCandidate {
  season: number
  round: number
  sprint: PointSessionCandidate | null
  race: PointSessionCandidate | null
}

interface AutomationRuntimeState {
  timer: ReturnType<typeof setInterval> | null
  running: boolean
  inFlight: boolean
  lastRunAtIso: string | null
}

const runtimeState: AutomationRuntimeState = {
  timer: null,
  running: false,
  inFlight: false,
  lastRunAtIso: null,
}

const localStateStore = new Map<string, AutomationState>()

function getAutomationStateKey(season: number, round: number): string {
  return `${AUTOMATION_KEY_PREFIX}:${season}:${round}`
}

async function loadAutomationState(season: number, round: number): Promise<AutomationState> {
  const key = getAutomationStateKey(season, round)
  const redis = await getRedisClient()

  if (redis) {
    try {
      const rawValue = await redis.get(key)
      if (rawValue) {
        return JSON.parse(rawValue) as AutomationState
      }
    } catch {
      // fall back to local state store
    }
  }

  return localStateStore.get(key) ?? {
    sprintResultsHash: null,
    raceResultsHash: null,
    lastMode: null,
    lastProcessedAtIso: null,
    lastError: null,
    attemptCount: 0,
    reconcileUntilIso: null,
  }
}

async function saveAutomationState(season: number, round: number, state: AutomationState): Promise<void> {
  const key = getAutomationStateKey(season, round)
  localStateStore.set(key, state)

  const redis = await getRedisClient()
  if (!redis) {
    return
  }

  try {
    await redis.set(key, JSON.stringify(state), {
      EX: Math.floor(RECONCILE_WINDOW_MS / 1000) * 7,
    })
  } catch {
    // keep local state only
  }
}

function hashNormalizedPayload(payload: unknown): string {
  return JSON.stringify(payload)
}

async function buildSprintResultsHash(season: number, round: number): Promise<string | null> {
  const roundResolution = await resolveExternalRound(season, round)
  const sprintResults = await fetchSprintResults(season, roundResolution.externalRound)
  if (!sprintResults || sprintResults.length === 0) {
    return null
  }

  const normalized = sprintResults
    .map((result) => ({
      driverId: result.Driver.driverId,
      position: Number(result.position),
      points: Number(result.points),
      status: result.status,
      grid: result.grid ?? null,
      laps: result.laps != null ? Number(result.laps) : null,
    }))
    .sort((left, right) => left.position - right.position || left.driverId.localeCompare(right.driverId))

  return hashNormalizedPayload(normalized)
}

async function buildRaceResultsHash(season: number, round: number): Promise<string | null> {
  const roundResolution = await resolveExternalRound(season, round)
  const raceResults = await fetchRaceResults(season, roundResolution.externalRound)
  if (!raceResults) {
    return null
  }

  const normalized = raceResults.Results
    .map((result) => ({
      driverId: result.Driver.driverId,
      position: Number(result.position),
      points: Number(result.points),
      status: result.status,
      grid: result.grid ?? null,
      laps: result.laps != null ? Number(result.laps) : null,
      fastestLapRank: result.FastestLap?.rank != null ? Number(result.FastestLap.rank) : null,
      fastestLapTime: result.FastestLap?.Time?.time ?? null,
    }))
    .sort((left, right) => left.position - right.position || left.driverId.localeCompare(right.driverId))

  return hashNormalizedPayload(normalized)
}

async function getLatestSessionStatus(sessionId: number): Promise<{ status: string; occurredAtUtc: Date } | null> {
  const db = getDb()
  if (!db) {
    return null
  }

  const [event] = await db
    .select({
      status: sessionStatusEvents.status,
      occurredAtUtc: sessionStatusEvents.occurredAtUtc,
    })
    .from(sessionStatusEvents)
    .where(eq(sessionStatusEvents.sessionId, sessionId))
    .orderBy(desc(sessionStatusEvents.occurredAtUtc), desc(sessionStatusEvents.id))
    .limit(1)

  return event ?? null
}

async function getRoundCandidates(): Promise<RoundCandidate[]> {
  const db = getDb()
  if (!db) {
    return []
  }

  const threshold = new Date(Date.now() - LOOKBACK_WINDOW_MS)

  const sessions = await db
    .select({
      sessionId: raceSessions.id,
      sessionType: raceSessions.sessionType,
      endTimeUtc: raceSessions.endTimeUtc,
      season: raceWeekends.season,
      round: raceWeekends.round,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        inArray(raceSessions.sessionType, ["Sprint", "Race"]),
        gt(raceSessions.endTimeUtc, threshold),
      ),
    )

  const grouped = new Map<string, RoundCandidate>()

  for (const session of sessions) {
    const latestStatus = await getLatestSessionStatus(session.sessionId)
    let finalisedAt = latestStatus?.status === "Finalised" ? latestStatus.occurredAtUtc : null

    if (!finalisedAt) {
      finalisedAt = await detectFinalisedViaFallback(session.sessionId, session.endTimeUtc)
    }

    const key = `${session.season}:${session.round}`
    const existing = grouped.get(key) ?? {
      season: session.season,
      round: session.round,
      sprint: null,
      race: null,
    }

    const candidate: PointSessionCandidate = {
      sessionId: session.sessionId,
      season: session.season,
      round: session.round,
      sessionType: session.sessionType as "Sprint" | "Race",
      endTimeUtc: session.endTimeUtc,
      finalisedAt,
    }

    if (candidate.sessionType === "Sprint") {
      existing.sprint = candidate
    } else {
      existing.race = candidate
    }

    grouped.set(key, existing)
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.season !== right.season) return right.season - left.season
    return right.round - left.round
  })
}

const FALLBACK_GRACE_HOURS = 2

async function detectFinalisedViaFallback(
  sessionId: number,
  endTimeUtc: Date,
): Promise<Date | null> {
  const graceTime = new Date(Date.now() - FALLBACK_GRACE_HOURS * 60 * 60 * 1000)
  if (endTimeUtc > graceTime) {
    return null
  }

  console.log(`[fantasy/automation] Fallback: session ${sessionId} detected as finalised via endTimeUtc`)

  return endTimeUtc
}

function isEligibleForProcessing(candidate: PointSessionCandidate | null, now: number): boolean {
  if (!candidate?.finalisedAt) {
    return false
  }

  return now - candidate.finalisedAt.getTime() >= FINALISED_DELAY_MS
}

async function runSprintSync(candidate: RoundCandidate, state: AutomationState): Promise<AutomationState> {
  const sprintHash = await buildSprintResultsHash(candidate.season, candidate.round)
  if (!sprintHash || sprintHash === state.sprintResultsHash) {
    return state
  }

  console.log(`[fantasy/automation] Sprint finalised — syncing round ${candidate.season}/${candidate.round}`)

  await runFantasyPostRound({
    season: candidate.season,
    round: candidate.round,
    requireRaceResults: false,
    includeScoring: true,
    evolvePrices: false,
  })

  return {
    ...state,
    sprintResultsHash: sprintHash,
    lastMode: "sprint_sync",
    lastProcessedAtIso: new Date().toISOString(),
    lastError: null,
    attemptCount: state.attemptCount + 1,
  }
}

async function runRacePostRound(candidate: RoundCandidate, state: AutomationState): Promise<AutomationState> {
  const raceHash = await buildRaceResultsHash(candidate.season, candidate.round)
  if (!raceHash) {
    return {
      ...state,
      lastError: "race results unavailable from Jolpica",
    }
  }

  const sprintHash = candidate.sprint ? await buildSprintResultsHash(candidate.season, candidate.round) : null
  const hashesChanged = raceHash !== state.raceResultsHash || sprintHash !== state.sprintResultsHash
  const reconcileUntil = candidate.race?.finalisedAt
    ? new Date(candidate.race.finalisedAt.getTime() + RECONCILE_WINDOW_MS).toISOString()
    : state.reconcileUntilIso

  if (!hashesChanged && state.lastMode === "race_post_round") {
    return {
      ...state,
      reconcileUntilIso: reconcileUntil,
    }
  }

  console.log(`[fantasy/automation] Race finalised/reconciled — processing round ${candidate.season}/${candidate.round}`)

  await runFantasyPostRound({
    season: candidate.season,
    round: candidate.round,
    requireRaceResults: true,
    includeScoring: true,
    evolvePrices: true,
  })

  return {
    ...state,
    sprintResultsHash: sprintHash,
    raceResultsHash: raceHash,
    lastMode: "race_post_round",
    lastProcessedAtIso: new Date().toISOString(),
    lastError: null,
    attemptCount: state.attemptCount + 1,
    reconcileUntilIso: reconcileUntil,
  }
}

async function processCandidate(candidate: RoundCandidate): Promise<void> {
  const now = Date.now()
  const state = await loadAutomationState(candidate.season, candidate.round)

  try {
    let nextState = state

    if (isEligibleForProcessing(candidate.sprint, now) && !isEligibleForProcessing(candidate.race, now)) {
      nextState = await runSprintSync(candidate, nextState)
    }

    const withinReconcileWindow = !nextState.reconcileUntilIso || new Date(nextState.reconcileUntilIso).getTime() >= now

    if (isEligibleForProcessing(candidate.race, now) && withinReconcileWindow) {
      nextState = await runRacePostRound(candidate, nextState)
    }

    await saveAutomationState(candidate.season, candidate.round, nextState)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[fantasy/automation] Round ${candidate.season}/${candidate.round} failed:`, message)
    await saveAutomationState(candidate.season, candidate.round, {
      ...state,
      lastError: message,
      attemptCount: state.attemptCount + 1,
    })
  }
}

async function checkAutomation(): Promise<void> {
  if (runtimeState.inFlight) {
    return
  }

  runtimeState.inFlight = true
  runtimeState.lastRunAtIso = new Date().toISOString()

  try {
    const candidates = await getRoundCandidates()
    for (const candidate of candidates) {
      await processCandidate(candidate)
    }
  } finally {
    runtimeState.inFlight = false
  }
}

export function startFantasyPostRoundAutomation(): void {
  if (runtimeState.running) {
    return
  }

  runtimeState.running = true
  console.log(`[fantasy/automation] Started — checking every ${POLL_INTERVAL_MS / 60_000}min`)

  checkAutomation().catch((error) => {
    console.error("[fantasy/automation] Initial check failed:", error)
  })

  runtimeState.timer = setInterval(() => {
    checkAutomation().catch((error) => {
      console.error("[fantasy/automation] Check failed:", error)
    })
  }, POLL_INTERVAL_MS)
}

export function getFantasyPostRoundAutomationStatus() {
  return {
    running: runtimeState.running,
    inFlight: runtimeState.inFlight,
    lastRunAtIso: runtimeState.lastRunAtIso,
  }
}

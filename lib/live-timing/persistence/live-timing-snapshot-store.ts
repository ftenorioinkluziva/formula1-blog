import "server-only"

import { GQL_ENDPOINT, LIVE_TIMING_SOURCE } from "@/lib/live-timing/constants"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"
import { appendLiveTimingLog } from "@/lib/live-timing/persistence/live-timing-file-log"
import { persistLiveTimingPhase1 } from "@/lib/db/race-control-messages"
import { persistLapSummariesFromLiveTiming } from "@/lib/db/lap-summaries"
import { updateQualifyingBestLapState } from "@/lib/live-timing/persistence/qualifying-best-lap-store"
import { updateQualifyingMiniSectorBestState } from "@/lib/live-timing/persistence/qualifying-mini-sector-best-store"
import {
  initSignalRBridge,
  getSignalRSnapshot,
  getSignalRSnapshotAge,
  isSignalRBridgeActive,
  onSignalRSnapshot,
} from "@/lib/live-timing/signalr/snapshot-bridge"

interface LiveTimingSnapshotSummary {
  driverCount: number
  raceMessageCount: number
  radioCaptureCount: number
  sessionStatus: string | null
  currentLap: number | null
}

interface LiveTimingSnapshot {
  id: string
  capturedAtIso: string
  capturedAtMs: number
  rawState: F1LiveTimingRawState
  summary: LiveTimingSnapshotSummary
}

interface SnapshotStoreStats {
  cacheHits: number
  upstreamFetches: number
  inFlightJoins: number
  errors: number
  latestSnapshotId: string | null
  latestSnapshotAgeMs: number | null
  historySize: number
  source: string
  signalRActive: boolean
}

const SNAPSHOT_TTL_ACTIVE_MS = 500
const SNAPSHOT_TTL_IDLE_MS = 5000
const SNAPSHOT_HISTORY_LIMIT = 120
const HIT_LOG_SAMPLE_EVERY = 50

const snapshotHistory: LiveTimingSnapshot[] = []

let inFlightFetch: Promise<LiveTimingSnapshot | null> | null = null
let cacheHits = 0
let upstreamFetches = 0
let inFlightJoins = 0
let errors = 0

function buildSnapshotSummary(rawState: F1LiveTimingRawState): LiveTimingSnapshotSummary {
  return {
    driverCount: Object.keys(rawState.DriverList || {}).length,
    raceMessageCount: Object.keys(rawState.RaceControlMessages?.Messages || {}).length,
    radioCaptureCount: Object.keys(rawState.TeamRadio?.Captures || {}).length,
    sessionStatus: rawState.SessionStatus?.Status || null,
    currentLap: Number(rawState.LapCount?.CurrentLap || 0) || null,
  }
}

function extractJsonObjects(input: string): string[] {
  const segments: string[] = []
  let depth = 0
  let inString = false
  let escaping = false
  let objectStart = -1

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaping) {
      escaping = false
      continue
    }

    if (char === "\\") {
      if (inString) escaping = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === "{") {
      if (depth === 0) objectStart = index
      depth += 1
      continue
    }

    if (char === "}") {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && objectStart >= 0) {
        const segment = input.slice(objectStart, index + 1).trim()
        if (segment) segments.push(segment)
        objectStart = -1
      }
    }
  }

  if (segments.length > 0) return segments

  const fallbackSegments = input
    .split("\n")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return fallbackSegments.length > 0 ? fallbackSegments : [input.trim()]
}

async function fetchFromF1MV(): Promise<F1LiveTimingRawState | null> {
  const response = await fetch(GQL_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ f1LiveTimingState {
        DriverList TimingData TimingAppData TimingStats
        WeatherData WeatherDataSeries SessionInfo SessionStatus ExtrapolatedClock TopThree TrackStatus
        RaceControlMessages TeamRadio LapCount LapSeries Position
        PitLaneTimeCollection ChampionshipPrediction
        ContentStreams AudioStreams SessionData
      }
      f1LiveTimingClock { paused systemTime trackTime liveTimingStartTime }
      }`,
    }),
  })

  if (!response.ok) return null

  const responseText = await response.text()

  let parsedResponse: {
    data?: { f1LiveTimingState?: F1LiveTimingRawState; f1LiveTimingClock?: Record<string, unknown> }
  } | null = null

  try {
    parsedResponse = JSON.parse(responseText) as {
      data?: { f1LiveTimingState?: F1LiveTimingRawState; f1LiveTimingClock?: Record<string, unknown> }
    }
  } catch {
    for (const segment of extractJsonObjects(responseText)) {
      try {
        const candidate = JSON.parse(segment) as {
          data?: { f1LiveTimingState?: F1LiveTimingRawState; f1LiveTimingClock?: Record<string, unknown> }
        }

        if (candidate?.data?.f1LiveTimingState) {
          parsedResponse = candidate
          break
        }
      } catch {
        // Skip malformed segment and keep trying.
      }
    }
  }

  if (!parsedResponse) {
    return null
  }

  const state = parsedResponse.data?.f1LiveTimingState || null
  if (!state) return null

  return {
    ...state,
    LiveTimingClock: parsedResponse.data?.f1LiveTimingClock || null,
  }
}

let signalRInitialized = false

async function initSignalRIfNeeded(): Promise<void> {
  if (signalRInitialized) return
  signalRInitialized = true

  try {
    await initSignalRBridge()

    if (process.env.RECORDING_ENABLED === '1') {
      try {
        const { startRecordingAsync } = await import('@/lib/live-timing/recording/recorder')
        await startRecordingAsync()
      } catch (err) {
        console.warn('[snapshot-store] Recording init failed (non-critical):', err)
      }
    }

    onSignalRSnapshot((rawState) => {
      const now = Date.now()
      const snapshot: LiveTimingSnapshot = {
        id: `sr-${now}-${Math.random().toString(36).slice(2, 8)}`,
        capturedAtIso: new Date(now).toISOString(),
        capturedAtMs: now,
        rawState,
        summary: buildSnapshotSummary(rawState),
      }

      updateQualifyingBestLapState(rawState, {
        capturedAtIso: snapshot.capturedAtIso,
        snapshotId: snapshot.id,
      })

      updateQualifyingMiniSectorBestState(rawState, {
        capturedAtIso: snapshot.capturedAtIso,
      })

      persistLiveTimingPhase1(rawState, snapshot.capturedAtIso).catch(() => {
        appendLiveTimingLog("db_persist_failed", {
          snapshotId: snapshot.id,
          source: "signalr-phase1",
        })
      })

      persistLapSummariesFromLiveTiming(rawState, snapshot.capturedAtIso).catch(() => {
        appendLiveTimingLog("db_persist_failed", {
          snapshotId: snapshot.id,
          source: "signalr-phase2",
        })
      })

      snapshotHistory.unshift(snapshot)
      if (snapshotHistory.length > SNAPSHOT_HISTORY_LIMIT) {
        snapshotHistory.splice(SNAPSHOT_HISTORY_LIMIT)
      }
    })

    console.log("[snapshot-store] SignalR bridge initialized — push mode active")
  } catch (err) {
    signalRInitialized = false
    console.error("[snapshot-store] SignalR init failed, will fall back to F1MV:", err)
  }
}

function fetchFromSignalR(): F1LiveTimingRawState | null {
  const age = getSignalRSnapshotAge()
  if (age > 30_000) return null
  return getSignalRSnapshot()
}

async function fetchUpstreamLiveTimingState(): Promise<F1LiveTimingRawState | null> {
  if (LIVE_TIMING_SOURCE === "signalr") {
    await initSignalRIfNeeded()

    if (isSignalRBridgeActive()) {
      return fetchFromSignalR()
    }

    console.warn("[snapshot-store] SignalR not active — returning no snapshot")
    return null
  }

  return fetchFromF1MV()
}

function getLatestSnapshot(): LiveTimingSnapshot | null {
  return snapshotHistory[0] || null
}

export function getLatestLiveTimingSnapshot(): LiveTimingSnapshot | null {
  return getLatestSnapshot()
}

function resolveSnapshotTtlMs(snapshot: LiveTimingSnapshot | null): number {
  const status = snapshot?.summary.sessionStatus || ""
  if (status === "Started") {
    return SNAPSHOT_TTL_ACTIVE_MS
  }
  return SNAPSHOT_TTL_IDLE_MS
}

function isLatestSnapshotFresh(now: number): boolean {
  const latest = getLatestSnapshot()
  if (!latest) return false
  const ttlMs = resolveSnapshotTtlMs(latest)
  return now - latest.capturedAtMs < ttlMs
}

async function fetchAndStoreSnapshot(now: number): Promise<LiveTimingSnapshot | null> {
  upstreamFetches += 1
  const startedAt = Date.now()

  try {
    const rawState = await fetchUpstreamLiveTimingState()
    if (!rawState) {
      appendLiveTimingLog("snapshot_fetch_failed", {
        durationMs: Date.now() - startedAt,
        upstreamFetches,
        cacheHits,
        inFlightJoins,
        errors,
      })
      return null
    }

    const snapshot: LiveTimingSnapshot = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      capturedAtIso: new Date(now).toISOString(),
      capturedAtMs: now,
      rawState,
      summary: buildSnapshotSummary(rawState),
    }

    updateQualifyingBestLapState(rawState, {
      capturedAtIso: snapshot.capturedAtIso,
      snapshotId: snapshot.id,
    })

    updateQualifyingMiniSectorBestState(rawState, {
      capturedAtIso: snapshot.capturedAtIso,
    })

    try {
      await persistLiveTimingPhase1(rawState, snapshot.capturedAtIso)
    } catch {
      appendLiveTimingLog("db_persist_failed", {
        snapshotId: snapshot.id,
        capturedAtIso: snapshot.capturedAtIso,
        source: "phase1",
      })
    }

    try {
      await persistLapSummariesFromLiveTiming(rawState, snapshot.capturedAtIso)
    } catch {
      appendLiveTimingLog("db_persist_failed", {
        snapshotId: snapshot.id,
        capturedAtIso: snapshot.capturedAtIso,
        source: "phase2",
      })
    }

    snapshotHistory.unshift(snapshot)
    if (snapshotHistory.length > SNAPSHOT_HISTORY_LIMIT) {
      snapshotHistory.splice(SNAPSHOT_HISTORY_LIMIT)
    }

    appendLiveTimingLog("snapshot_fetched", {
      snapshotId: snapshot.id,
      capturedAtIso: snapshot.capturedAtIso,
      durationMs: Date.now() - startedAt,
      summary: snapshot.summary,
      historySize: snapshotHistory.length,
      upstreamFetches,
      cacheHits,
      inFlightJoins,
      errors,
    })

    return snapshot
  } catch {
    errors += 1
    appendLiveTimingLog("snapshot_fetch_failed", {
      durationMs: Date.now() - startedAt,
      upstreamFetches,
      cacheHits,
      inFlightJoins,
      errors,
    })
    return null
  }
}

export async function getSharedLiveTimingSnapshot(forceRefresh = false): Promise<LiveTimingSnapshot | null> {
  const now = Date.now()

  if (!forceRefresh && isLatestSnapshotFresh(now)) {
    cacheHits += 1
    if (cacheHits % HIT_LOG_SAMPLE_EVERY === 0) {
      appendLiveTimingLog("cache_hit", {
        cacheHits,
        upstreamFetches,
        inFlightJoins,
        errors,
      })
    }
    return getLatestSnapshot()
  }

  if (inFlightFetch) {
    inFlightJoins += 1
    if (inFlightJoins % HIT_LOG_SAMPLE_EVERY === 0) {
      appendLiveTimingLog("inflight_join", {
        cacheHits,
        upstreamFetches,
        inFlightJoins,
        errors,
      })
    }
    return inFlightFetch
  }

  inFlightFetch = fetchAndStoreSnapshot(now)
  const snapshot = await inFlightFetch
  inFlightFetch = null
  return snapshot
}

export function getLiveTimingSnapshotHistory(limit = 30): LiveTimingSnapshot[] {
  const normalizedLimit = Math.max(1, Math.min(limit, SNAPSHOT_HISTORY_LIMIT))
  return snapshotHistory.slice(0, normalizedLimit)
}

export function getLiveTimingSnapshotStoreStats(): SnapshotStoreStats {
  const latest = getLatestSnapshot()
  return {
    cacheHits,
    upstreamFetches,
    inFlightJoins,
    errors,
    latestSnapshotId: latest?.id || null,
    latestSnapshotAgeMs: latest ? Date.now() - latest.capturedAtMs : null,
    historySize: snapshotHistory.length,
    source: LIVE_TIMING_SOURCE,
    signalRActive: isSignalRBridgeActive(),
  }
}

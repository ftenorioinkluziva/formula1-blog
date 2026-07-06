import "server-only"

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
    console.error("[snapshot-store] SignalR init failed:", err)
  }
}

function fetchFromSignalR(): F1LiveTimingRawState | null {
  const age = getSignalRSnapshotAge()
  if (age > 30_000) return null
  return getSignalRSnapshot()
}

async function fetchUpstreamLiveTimingState(): Promise<F1LiveTimingRawState | null> {
  await initSignalRIfNeeded()

  if (isSignalRBridgeActive()) {
    return fetchFromSignalR()
  }

  console.warn("[snapshot-store] SignalR not active — returning no snapshot")
  return null
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
    source: "signalr",
    signalRActive: isSignalRBridgeActive(),
  }
}

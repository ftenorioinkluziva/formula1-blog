import "server-only"

import { parseLapTimeToMs, toNumber } from "@/lib/live-timing/formatters"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"

export interface QualifyingBestLapEntry {
  racingNumber: string
  tla: string
  fullName: string
  teamName: string
  teamColour: string
  bestLapTime: string
  bestLapMs: number
  source: "timingStats" | "timingData"
  currentLapWhenUpdated: number | null
  updatedAtIso: string
  snapshotId?: string
}

interface QualifyingBestLapState {
  sessionId: string | null
  sessionLabel: string | null
  isQualifyingSession: boolean
  updatedAtIso: string | null
  entries: QualifyingBestLapEntry[]
}

interface QualifyingBestLapUpdateResult {
  sessionChanged: boolean
  updatedDrivers: number
  trackedDrivers: number
  isQualifyingSession: boolean
}

const MIN_VALID_LAP_MS = 45_000
const MAX_VALID_LAP_MS = 300_000

const bestLapByDriver = new Map<string, QualifyingBestLapEntry>()

let currentSessionId: string | null = null
let currentSessionLabel: string | null = null
let isQualifyingSession = false
let updatedAtIso: string | null = null

function normalizeSessionToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function getNestedString(record: Record<string, unknown> | undefined, outerKey: string, innerKey: string): string | null {
  const outer = asRecord(record?.[outerKey])
  const value = outer[innerKey]
  return typeof value === "string" ? value : null
}

function resolveSessionContext(rawState: F1LiveTimingRawState): {
  sessionId: string
  sessionLabel: string
  isQualifyingSession: boolean
} {
  const sessionInfo = asRecord(rawState.SessionInfo)
  const meeting = asRecord(sessionInfo.Meeting)

  const type = getString(sessionInfo.Type)
  const name = getString(sessionInfo.Name)
  const path = getString(sessionInfo.Path)
  const meetingName = getString(meeting.Name)
  const location = getString(meeting.Location)

  const keyParts = [
    String(meeting.Key || ""),
    String(sessionInfo.Key || ""),
    path,
    meetingName,
    type,
    name,
    location,
  ].map((part) => part.trim()).filter(Boolean)

  const sessionId = keyParts.join("|") || "unknown-session"
  const sessionLabel = [meetingName || location, type || name].filter(Boolean).join(" - ") || sessionId

  const token = [
    normalizeSessionToken(type),
    normalizeSessionToken(name),
    normalizeSessionToken(path),
  ].join(" ")

  const isQualifying =
    token.includes("qualifying") ||
    token.includes("qualification") ||
    /\bq[123]\b/.test(token)

  return {
    sessionId,
    sessionLabel,
    isQualifyingSession: isQualifying,
  }
}

function parseValidLapMs(value: unknown): number | null {
  if (typeof value !== "string") return null
  const lapMs = parseLapTimeToMs(value.trim())
  if (!lapMs) return null
  if (lapMs < MIN_VALID_LAP_MS || lapMs > MAX_VALID_LAP_MS) return null
  return lapMs
}

function resolveBestLapCandidate(
  statsLine: Record<string, unknown> | undefined,
  timingLine: Record<string, unknown> | undefined,
): {
  bestLapTime: string
  bestLapMs: number
  source: "timingStats" | "timingData"
} | null {
  const statsBest = getNestedString(statsLine, "BestLapTime", "Value")
  const statsBestMs = parseValidLapMs(statsBest)

  const timingBest = getNestedString(timingLine, "BestLapTime", "Value")
  const timingBestMs = parseValidLapMs(timingBest)

  if (statsBestMs !== null && timingBestMs !== null) {
    if (statsBestMs <= timingBestMs) {
      return { bestLapTime: statsBest!, bestLapMs: statsBestMs, source: "timingStats" }
    }
    return { bestLapTime: timingBest!, bestLapMs: timingBestMs, source: "timingData" }
  }

  if (statsBestMs !== null) {
    return { bestLapTime: statsBest!, bestLapMs: statsBestMs, source: "timingStats" }
  }

  if (timingBestMs !== null) {
    return { bestLapTime: timingBest!, bestLapMs: timingBestMs, source: "timingData" }
  }

  return null
}

export function updateQualifyingBestLapState(
  rawState: F1LiveTimingRawState,
  snapshotMeta: { capturedAtIso: string; snapshotId?: string },
): QualifyingBestLapUpdateResult {
  const context = resolveSessionContext(rawState)
  const sessionChanged = context.sessionId !== currentSessionId

  if (sessionChanged) {
    bestLapByDriver.clear()
  }

  currentSessionId = context.sessionId
  currentSessionLabel = context.sessionLabel
  isQualifyingSession = context.isQualifyingSession
  updatedAtIso = snapshotMeta.capturedAtIso

  if (!isQualifyingSession) {
    return {
      sessionChanged,
      updatedDrivers: 0,
      trackedDrivers: bestLapByDriver.size,
      isQualifyingSession,
    }
  }

  const driverList = asRecord(rawState.DriverList)
  const timingLines = asRecord(asRecord(rawState.TimingData).Lines)
  const timingStatsLines = asRecord(asRecord(rawState.TimingStats).Lines)

  const driverNumbers = new Set<string>([
    ...Object.keys(timingLines),
    ...Object.keys(timingStatsLines),
  ])

  let updatedDrivers = 0

  for (const racingNumber of driverNumbers) {
    const timingLine = asRecord(timingLines[racingNumber])
    const statsLine = asRecord(timingStatsLines[racingNumber])
    const candidate = resolveBestLapCandidate(statsLine, timingLine)

    if (!candidate) continue

    const existing = bestLapByDriver.get(racingNumber)
    if (existing && existing.bestLapMs <= candidate.bestLapMs) {
      continue
    }

    const driver = asRecord(driverList[racingNumber])
    bestLapByDriver.set(racingNumber, {
      racingNumber,
      tla: String(driver.Tla || racingNumber),
      fullName: String(driver.FullName || racingNumber),
      teamName: String(driver.TeamName || ""),
      teamColour: String(driver.TeamColour || "808080"),
      bestLapTime: candidate.bestLapTime,
      bestLapMs: candidate.bestLapMs,
      source: candidate.source,
      currentLapWhenUpdated: toNumber(timingLine.NumberOfLaps),
      updatedAtIso: snapshotMeta.capturedAtIso,
      snapshotId: snapshotMeta.snapshotId,
    })

    updatedDrivers += 1
  }

  return {
    sessionChanged,
    updatedDrivers,
    trackedDrivers: bestLapByDriver.size,
    isQualifyingSession,
  }
}

export function getQualifyingBestLapState(): QualifyingBestLapState {
  const entries = Array.from(bestLapByDriver.values()).sort((a, b) => a.bestLapMs - b.bestLapMs)

  return {
    sessionId: currentSessionId,
    sessionLabel: currentSessionLabel,
    isQualifyingSession,
    updatedAtIso,
    entries,
  }
}

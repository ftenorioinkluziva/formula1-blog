import "server-only"

import { normalizeEntries, parseLapTimeToMs, toNumber } from "@/lib/live-timing/formatters"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"

interface PersistedSectorMini {
  stopped: boolean
  value: string
  overallFastest: boolean
  personalFastest: boolean
  segments: Array<{ status: number }>
}

interface DriverBestMiniSectors {
  racingNumber: string
  bestLapMs: number
  sectors: PersistedSectorMini[]
}

export interface QualifyingMiniSectorBestState {
  sessionId: string | null
  updatedAtIso: string | null
  drivers: Record<string, DriverBestMiniSectors>
}

const MIN_VALID_SECTOR_MS = 10_000
const MAX_VALID_SECTOR_MS = 120_000
const MIN_VALID_LAP_MS = 45_000
const MAX_VALID_LAP_MS = 300_000

let currentSessionId: string | null = null
let updatedAtIso: string | null = null
const bestByDriver = new Map<string, DriverBestMiniSectors>()

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

function resolveSessionId(rawState: F1LiveTimingRawState): string {
  const sessionInfo = asRecord(rawState.SessionInfo)
  const meeting = asRecord(sessionInfo.Meeting)
  const parts = [
    getString(meeting.Key).trim(),
    getString(sessionInfo.Key).trim(),
    getString(sessionInfo.Path).trim(),
    getString(meeting.Name).trim(),
    getString(sessionInfo.Type).trim(),
  ].filter(Boolean)

  return parts.join("|") || "unknown-session"
}

function parseSectorMs(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null

  if (normalized.includes(":")) {
    const parsed = parseLapTimeToMs(normalized)
    if (!parsed) return null
    if (parsed < MIN_VALID_SECTOR_MS || parsed > MAX_VALID_SECTOR_MS) return null
    return parsed
  }

  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return null
  const ms = Math.round(numeric * 1000)
  if (ms < MIN_VALID_SECTOR_MS || ms > MAX_VALID_SECTOR_MS) return null
  return ms
}

function mapSector(sector: unknown): PersistedSectorMini {
  const sectorRecord = asRecord(sector)
  const rawSegments = normalizeEntries<unknown>(sectorRecord.Segments)

  return {
    stopped: sectorRecord.Stopped === true,
    value: getString(sectorRecord.Value),
    overallFastest: sectorRecord.OverallFastest === true,
    personalFastest: sectorRecord.PersonalFastest === true,
    segments: rawSegments.map((segment) => {
      const segmentRecord = asRecord(segment)
      return { status: toNumber(segmentRecord.Status) || 0 }
    }),
  }
}

function parseLapMs(value: unknown): number | null {
  if (typeof value !== "string") return null
  const parsed = parseLapTimeToMs(value.trim())
  if (!parsed) return null
  if (parsed < MIN_VALID_LAP_MS || parsed > MAX_VALID_LAP_MS) return null
  return parsed
}

function mapCompleteLapSectors(rawSectors: unknown[]): PersistedSectorMini[] | null {
  if (rawSectors.length < 3) return null

  const mapped = rawSectors.slice(0, 3).map(mapSector)
  const allSectorsHaveValue = mapped.every((sector) => parseSectorMs(sector.value) !== null)

  if (!allSectorsHaveValue) return null
  return mapped
}

export function updateQualifyingMiniSectorBestState(
  rawState: F1LiveTimingRawState,
  snapshotMeta: { capturedAtIso: string },
): void {
  const sessionId = resolveSessionId(rawState)
  if (sessionId !== currentSessionId) {
    bestByDriver.clear()
  }

  currentSessionId = sessionId
  updatedAtIso = snapshotMeta.capturedAtIso

  const timingLines = asRecord(asRecord(rawState.TimingData).Lines)

  for (const [racingNumber, line] of Object.entries(timingLines)) {
    const lineRecord = asRecord(line)
    const rawSectors = normalizeEntries<unknown>(lineRecord.Sectors)

    if (rawSectors.length === 0) continue
    const currentBestLapMs = parseLapMs(getNestedString(lineRecord, "BestLapTime", "Value"))
    if (currentBestLapMs === null) continue

    const completeLapSectors = mapCompleteLapSectors(rawSectors)
    if (!completeLapSectors) continue

    const existing = bestByDriver.get(racingNumber)
    if (existing && existing.bestLapMs <= currentBestLapMs) {
      continue
    }

    bestByDriver.set(racingNumber, {
      racingNumber,
      bestLapMs: currentBestLapMs,
      sectors: completeLapSectors,
    })
  }
}

export function getQualifyingMiniSectorBestState(): QualifyingMiniSectorBestState {
  const drivers: Record<string, DriverBestMiniSectors> = {}

  for (const [racingNumber, driverBest] of bestByDriver.entries()) {
    drivers[racingNumber] = {
      racingNumber,
      bestLapMs: driverBest.bestLapMs,
      sectors: driverBest.sectors,
    }
  }

  return {
    sessionId: currentSessionId,
    updatedAtIso,
    drivers,
  }
}

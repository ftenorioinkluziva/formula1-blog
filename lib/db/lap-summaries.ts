import { and, asc, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, lapSummaries } from "@/lib/db/schema"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"
import { parseDateOrNull, parseInteger, resolveLiveSessionId } from "@/lib/db/live-session-resolver"

export interface LapSummaryItem {
  id: number
  sessionId: number
  driver: {
    id: number
    number: number
    code: string
    fullName: string
  }
  lapNumber: number
  lapTime: string | null
  sector1: string | null
  sector2: string | null
  sector3: string | null
  pitIn: boolean
  pitOut: boolean
  occurredAtUtc: string
}

function extractSectorValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim()
    if (normalized.length > 0 && normalized !== "—") {
      return normalized
    }
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (typeof obj.Value === "string") {
      const normalized = obj.Value.trim()
      if (normalized.length > 0 && normalized !== "—") {
        return normalized
      }
    }
  }

  return null
}

function extractSectors(line: Record<string, unknown>): [string | null, string | null, string | null] {
  const sectorsRaw = line.Sectors

  if (!sectorsRaw || typeof sectorsRaw !== "object") {
    return [null, null, null]
  }

  const sectors = Array.isArray(sectorsRaw)
    ? sectorsRaw
    : Object.values(sectorsRaw as Record<string, unknown>)

  return [
    extractSectorValue(sectors[0]),
    extractSectorValue(sectors[1]),
    extractSectorValue(sectors[2]),
  ]
}

function extractLapTime(line: Record<string, unknown>): string | null {
  const lastLapTime = line.LastLapTime

  if (lastLapTime && typeof lastLapTime === "object") {
    const maybeValue = (lastLapTime as Record<string, unknown>).Value

    if (typeof maybeValue === "string") {
      const normalized = maybeValue.trim()
      if (normalized.length > 0 && normalized !== "—") {
        return normalized
      }
    }
  }

  return null
}

export async function persistLapSummariesFromLiveTiming(
  rawState: F1LiveTimingRawState,
  capturedAtIso: string,
): Promise<void> {
  const db = getDb()

  if (!db) {
    return
  }

  const capturedAt = parseDateOrNull(capturedAtIso) ?? new Date()
  const sessionId = await resolveLiveSessionId(rawState, capturedAt)

  if (!sessionId) {
    return
  }

  const timingLines = (rawState.TimingData?.Lines || {}) as Record<string, Record<string, unknown>>

  if (Object.keys(timingLines).length === 0) {
    return
  }

  const driverRows = await db
    .select({
      id: drivers.id,
      number: drivers.driverNumber,
    })
    .from(drivers)

  const driverByNumber = new Map<number, number>()

  for (const row of driverRows) {
    driverByNumber.set(row.number, row.id)
  }

  const values: Array<typeof lapSummaries.$inferInsert> = []

  for (const [racingNumber, line] of Object.entries(timingLines)) {
    const parsedRacingNumber = Number(racingNumber)

    if (!Number.isInteger(parsedRacingNumber)) {
      continue
    }

    const driverId = driverByNumber.get(parsedRacingNumber)

    if (!driverId) {
      continue
    }

    const lapNumber = parseInteger(line.NumberOfLaps)

    if (!lapNumber || lapNumber <= 0) {
      continue
    }

    const lapTime = extractLapTime(line)

    if (!lapTime) {
      continue
    }

    const [sector1, sector2, sector3] = extractSectors(line)

    values.push({
      sessionId,
      driverId,
      lapNumber,
      lapTime,
      sector1,
      sector2,
      sector3,
      pitIn: line.InPit === true,
      pitOut: line.PitOut === true,
      occurredAtUtc: capturedAt,
    })
  }

  if (values.length === 0) {
    return
  }

  await db
    .insert(lapSummaries)
    .values(values)
    .onConflictDoNothing()
}

export async function getLapSummaries(
  sessionId: number,
  limit = 400,
): Promise<LapSummaryItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const normalizedLimit = Math.max(1, Math.min(limit, 2000))

  const rows = await db
    .select({
      summary: lapSummaries,
      driver: drivers,
    })
    .from(lapSummaries)
    .innerJoin(drivers, eq(lapSummaries.driverId, drivers.id))
    .where(eq(lapSummaries.sessionId, sessionId))
    .orderBy(desc(lapSummaries.lapNumber), asc(drivers.driverNumber))
    .limit(normalizedLimit)

  return rows
    .map((row) => ({
      id: row.summary.id,
      sessionId: row.summary.sessionId,
      driver: {
        id: row.driver.id,
        number: row.driver.driverNumber,
        code: row.driver.code,
        fullName: row.driver.fullName,
      },
      lapNumber: row.summary.lapNumber,
      lapTime: row.summary.lapTime,
      sector1: row.summary.sector1,
      sector2: row.summary.sector2,
      sector3: row.summary.sector3,
      pitIn: row.summary.pitIn,
      pitOut: row.summary.pitOut,
      occurredAtUtc: row.summary.occurredAtUtc.toISOString(),
    }))
    .sort((left, right) => {
      if (left.lapNumber !== right.lapNumber) {
        return left.lapNumber - right.lapNumber
      }

      return left.driver.number - right.driver.number
    })
}

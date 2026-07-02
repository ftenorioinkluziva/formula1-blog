import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { carTelemetry, drivers, lapSummaries, raceControlMessages, raceIntervals, raceSessions, raceWeekends, sessionWeather, teamRadio, tireStints } from "@/lib/db/schema"
import type { OpenF1Stint, OpenF1Lap, OpenF1Weather, OpenF1RaceControl, OpenF1Interval, OpenF1CarData, OpenF1TeamRadio } from "@/lib/openf1/client"

async function resolveDriverIdByNumber(driverNumber: number): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(eq(drivers.driverNumber, driverNumber))
    .limit(1)

  return rows[0]?.id ?? null
}

async function resolveSessionIdForSync(
  season: number,
  round: number,
  sessionCode: string,
): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db
    .select({ sessionId: raceSessions.id })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        eq(raceWeekends.season, season),
        eq(raceWeekends.round, round),
        eq(raceSessions.sessionCode, sessionCode),
      ),
    )
    .limit(1)

  return rows[0]?.sessionId ?? null
}

export async function syncTireStints(
  stints: OpenF1Stint[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()
  if (!db) return { inserted: 0, skipped: ["no db"] }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0, skipped: ["session not found"] }

  let inserted = 0
  const skipped: string[] = []

  for (const stint of stints) {
    const driverId = await resolveDriverIdByNumber(stint.driver_number)
    if (!driverId) {
      skipped.push(`driver #${stint.driver_number}`)
      continue
    }

    const compound = stint.compound?.toUpperCase() ?? "UNKNOWN"

    try {
      await db
        .insert(tireStints)
        .values({
          sessionId,
          driverId,
          stintNumber: stint.stint_number,
          compound,
          lapStart: stint.lap_start,
          lapEnd: stint.lap_end,
          tyreAgeAtStart: stint.tyre_age_at_start ?? 0,
        })
        .onConflictDoUpdate({
          target: [tireStints.sessionId, tireStints.driverId, tireStints.stintNumber],
          set: {
            compound,
            lapStart: stint.lap_start,
            lapEnd: stint.lap_end,
            tyreAgeAtStart: stint.tyre_age_at_start ?? 0,
          },
        })
      inserted++
    } catch {
      skipped.push(`stint #${stint.stint_number} driver #${stint.driver_number}`)
    }
  }

  return { inserted, skipped }
}

export async function enrichLapSummariesWithOpenF1(
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ updated: number; skipped: string[] }> {
  const db = getDb()
  if (!db) return { updated: 0, skipped: ["no db"] }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { updated: 0, skipped: ["session not found"] }

  const stintsByDriver = new Map<number, OpenF1Stint[]>()
  for (const s of stints) {
    const arr = stintsByDriver.get(s.driver_number) ?? []
    arr.push(s)
    stintsByDriver.set(s.driver_number, arr)
  }

  function findCompound(driverNumber: number, lapNumber: number): string | null {
    const driverStints = stintsByDriver.get(driverNumber) ?? []
    for (const s of driverStints) {
      if (lapNumber >= s.lap_start && lapNumber <= s.lap_end) {
        return s.compound?.toUpperCase() ?? null
      }
    }
    return null
  }

  let updated = 0
  const skipped: string[] = []

  for (const lap of laps) {
    const driverId = await resolveDriverIdByNumber(lap.driver_number)
    if (!driverId) continue

    const compound = findCompound(lap.driver_number, lap.lap_number)

    try {
      const existingRow = await db
        .select({
          i1Speed: lapSummaries.i1Speed,
          i2Speed: lapSummaries.i2Speed,
          stSpeed: lapSummaries.stSpeed,
          compound: lapSummaries.compound,
          sector1: lapSummaries.sector1,
          sector2: lapSummaries.sector2,
          sector3: lapSummaries.sector3,
        })
        .from(lapSummaries)
        .where(
          and(
            eq(lapSummaries.sessionId, sessionId),
            eq(lapSummaries.driverId, driverId),
            eq(lapSummaries.lapNumber, lap.lap_number),
          ),
        )
        .limit(1)

      const current = existingRow[0]
      if (!current) {
        skipped.push(`lap ${lap.lap_number} driver #${lap.driver_number}`)
        continue
      }

      const result = await db
        .update(lapSummaries)
        .set({
          i1Speed: current.i1Speed ?? lap.i1_speed,
          i2Speed: current.i2Speed ?? lap.i2_speed,
          stSpeed: current.stSpeed ?? lap.st_speed,
          compound: current.compound ?? compound,
          sector1: current.sector1 ?? (lap.duration_sector_1 != null ? lap.duration_sector_1.toFixed(3) : null),
          sector2: current.sector2 ?? (lap.duration_sector_2 != null ? lap.duration_sector_2.toFixed(3) : null),
          sector3: current.sector3 ?? (lap.duration_sector_3 != null ? lap.duration_sector_3.toFixed(3) : null),
        })
        .where(
          and(
            eq(lapSummaries.sessionId, sessionId),
            eq(lapSummaries.driverId, driverId),
            eq(lapSummaries.lapNumber, lap.lap_number),
          ),
        )

      if (result.rowCount && result.rowCount > 0) updated++
    } catch {
      skipped.push(`lap ${lap.lap_number} driver #${lap.driver_number}`)
    }
  }

  return { updated, skipped }
}

export async function syncSessionWeather(
  weatherData: OpenF1Weather[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number }> {
  const db = getDb()
  if (!db) return { inserted: 0 }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0 }

  await db.delete(sessionWeather).where(eq(sessionWeather.sessionId, sessionId))

  if (weatherData.length === 0) return { inserted: 0 }

  const SAMPLE_INTERVAL = 60_000
  let lastTimestamp = 0
  const sampled: OpenF1Weather[] = []

  for (const w of weatherData) {
    const ts = new Date(w.date).getTime()
    if (ts - lastTimestamp >= SAMPLE_INTERVAL) {
      sampled.push(w)
      lastTimestamp = ts
    }
  }

  const rows = sampled.map((w) => ({
    sessionId,
    airTemperature: w.air_temperature,
    trackTemperature: w.track_temperature,
    humidity: Math.round(w.humidity),
    pressure: w.pressure,
    rainfall: w.rainfall === 1,
    windDirection: Math.round(w.wind_direction),
    windSpeed: w.wind_speed,
    recordedAtUtc: new Date(w.date),
  }))

  const BATCH_SIZE = 10
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(sessionWeather).values(rows.slice(i, i + BATCH_SIZE))
  }

  return { inserted: rows.length }
}

export async function syncRaceControlFromOpenF1(
  data: OpenF1RaceControl[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number }> {
  const db = getDb()
  if (!db) return { inserted: 0 }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0 }

  const trackScoped = data.filter((d) => d.message && d.message.trim().length > 0)
  if (trackScoped.length === 0) return { inserted: 0 }

  let inserted = 0

  for (const msg of trackScoped) {
    const messageType = msg.category?.trim() || "Other"
    const flag = msg.flag?.trim() || ""
    const lap = msg.lap_number ?? -1
    const messageText = msg.message.trim()
    const racingNumber = msg.driver_number != null ? String(msg.driver_number) : ""

    try {
      await db
        .insert(raceControlMessages)
        .values({
          sessionId,
          messageType,
          flag,
          lap,
          messageText,
          racingNumber,
          occurredAtUtc: new Date(msg.date),
        })
        .onConflictDoNothing()
      inserted++
    } catch {
      // dedup conflict or other error — skip
    }
  }

  return { inserted }
}

export async function syncRaceIntervals(
  intervals: OpenF1Interval[],
  laps: OpenF1Lap[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()
  if (!db) return { inserted: 0, skipped: ["no db"] }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0, skipped: ["session not found"] }

  const lapStartTimes = new Map<string, number>()
  for (const lap of laps) {
    if (lap.date_start) {
      const key = `${lap.driver_number}-${lap.lap_number}`
      lapStartTimes.set(key, new Date(lap.date_start).getTime())
    }
  }

  const maxLap = Math.max(...laps.map((l) => l.lap_number), 0)
  const perDriverLap = new Map<string, { gap: number | null; interval: number | null }>()

  for (const iv of intervals) {
    const ts = new Date(iv.date).getTime()
    const gap = typeof iv.gap_to_leader === "number" ? iv.gap_to_leader : null
    const interval = typeof iv.interval === "number" ? iv.interval : null

    if (gap === null && interval === null) continue

    for (let lapNum = 1; lapNum <= maxLap; lapNum++) {
      const lapKey = `${iv.driver_number}-${lapNum}`
      const lapStart = lapStartTimes.get(lapKey)
      const nextLapKey = `${iv.driver_number}-${lapNum + 1}`
      const nextLapStart = lapStartTimes.get(nextLapKey)

      if (lapStart && nextLapStart && ts >= lapStart && ts < nextLapStart) {
        const existing = perDriverLap.get(lapKey)
        if (!existing) {
          perDriverLap.set(lapKey, { gap, interval })
        }
        break
      }

      if (lapStart && !nextLapStart && lapNum === maxLap && ts >= lapStart) {
        if (!perDriverLap.has(lapKey)) {
          perDriverLap.set(lapKey, { gap, interval })
        }
        break
      }
    }
  }

  let inserted = 0
  const skipped: string[] = []

  for (const [key, val] of perDriverLap) {
    const [driverNumStr, lapNumStr] = key.split("-")
    const driverNumber = parseInt(driverNumStr, 10)
    const lapNumber = parseInt(lapNumStr, 10)

    const driverId = await resolveDriverIdByNumber(driverNumber)
    if (!driverId) {
      skipped.push(`driver #${driverNumber}`)
      continue
    }

    try {
      await db
        .insert(raceIntervals)
        .values({
          sessionId,
          driverId,
          lapNumber,
          gapToLeader: val.gap,
          intervalToAhead: val.interval,
        })
        .onConflictDoUpdate({
          target: [raceIntervals.sessionId, raceIntervals.driverId, raceIntervals.lapNumber],
          set: {
            gapToLeader: val.gap,
            intervalToAhead: val.interval,
          },
        })
      inserted++
    } catch {
      skipped.push(`interval lap ${lapNumber} driver #${driverNumber}`)
    }
  }

  return { inserted, skipped }
}

export async function syncPoleTelemetry(
  carData: OpenF1CarData[],
  laps: OpenF1Lap[],
  poleDriverNumber: number,
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()
  if (!db) return { inserted: 0, skipped: ["no db"] }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0, skipped: ["session not found"] }

  const driverId = await resolveDriverIdByNumber(poleDriverNumber)
  if (!driverId) return { inserted: 0, skipped: [`driver #${poleDriverNumber} not found`] }

  const driverLaps = laps
    .filter((l) => l.driver_number === poleDriverNumber && l.lap_duration !== null)
    .sort((a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity))

  if (driverLaps.length === 0) return { inserted: 0, skipped: ["no laps with duration"] }

  const fastestLap = driverLaps[0]
  const lapNumber = fastestLap.lap_number
  const lapStart = new Date(fastestLap.date_start).getTime()

  const nextLap = laps.find(
    (l) => l.driver_number === poleDriverNumber && l.lap_number === lapNumber + 1,
  )
  const lapEnd = nextLap
    ? new Date(nextLap.date_start).getTime()
    : lapStart + (fastestLap.lap_duration! * 1000) + 2000

  const lapSamples = carData.filter((d) => {
    const ts = new Date(d.date).getTime()
    return d.driver_number === poleDriverNumber && ts >= lapStart && ts < lapEnd
  })

  if (lapSamples.length === 0) return { inserted: 0, skipped: ["no car data for fastest lap"] }

  await db.delete(carTelemetry).where(
    and(
      eq(carTelemetry.sessionId, sessionId),
      eq(carTelemetry.driverId, driverId),
      eq(carTelemetry.lapNumber, lapNumber),
    ),
  )

  const BATCH_SIZE = 50
  let inserted = 0

  for (let i = 0; i < lapSamples.length; i += BATCH_SIZE) {
    const batch = lapSamples.slice(i, i + BATCH_SIZE).map((sample, idx) => ({
      sessionId,
      driverId,
      lapNumber,
      sampleIndex: i + idx,
      speed: Math.round(sample.speed ?? 0),
      throttle: Math.round(sample.throttle ?? 0),
      brake: Math.round(sample.brake ?? 0),
      rpm: Math.round(sample.rpm ?? 0),
      gear: sample.n_gear ?? 0,
      drs: sample.drs ?? 0,
      recordedAtUtc: new Date(sample.date),
    }))

    await db.insert(carTelemetry).values(batch)
    inserted += batch.length
  }

  return { inserted, skipped: [] }
}

export async function syncTeamRadio(
  radioData: OpenF1TeamRadio[],
  laps: OpenF1Lap[],
  season: number,
  round: number,
  sessionCode: string,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()
  if (!db) return { inserted: 0, skipped: ["no db"] }

  const sessionId = await resolveSessionIdForSync(season, round, sessionCode)
  if (!sessionId) return { inserted: 0, skipped: ["session not found"] }

  const lapStartTimes = new Map<string, number>()
  for (const lap of laps) {
    if (lap.date_start) {
      lapStartTimes.set(`${lap.driver_number}-${lap.lap_number}`, new Date(lap.date_start).getTime())
    }
  }
  const maxLap = Math.max(...laps.map((l) => l.lap_number), 0)

  function findLapForTimestamp(driverNumber: number, timestamp: number): number | null {
    for (let lapNum = maxLap; lapNum >= 1; lapNum--) {
      const lapStart = lapStartTimes.get(`${driverNumber}-${lapNum}`)
      if (lapStart && timestamp >= lapStart) return lapNum
    }
    return null
  }

  let inserted = 0
  const skipped: string[] = []

  for (const radio of radioData) {
    if (!radio.recording_url) continue

    const driverId = await resolveDriverIdByNumber(radio.driver_number)
    if (!driverId) {
      skipped.push(`driver #${radio.driver_number}`)
      continue
    }

    const lap = findLapForTimestamp(radio.driver_number, new Date(radio.date).getTime())

    try {
      await db
        .insert(teamRadio)
        .values({
          sessionId,
          driverId,
          recordingUrl: radio.recording_url,
          lap,
          occurredAtUtc: new Date(radio.date),
        })
        .onConflictDoNothing()
      inserted++
    } catch {
      skipped.push(`radio ${radio.date} driver #${radio.driver_number}`)
    }
  }

  return { inserted, skipped }
}

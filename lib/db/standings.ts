import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, lapSummaries, pitStops, circuits, raceSessions, raceWeekends, sessionResults, teams } from "@/lib/db/schema"
import type { JolpicaDriverStanding, JolpicaConstructorStanding, JolpicaRaceResult, JolpicaQualifyingResult, JolpicaLap, JolpicaPitStop, JolpicaScheduleRace } from "@/lib/jolpica/client"

/**
 * Jolpica constructor names → DB team names.
 * Keys are lowercased Jolpica constructorId values.
 */
const CONSTRUCTOR_ALIAS: Record<string, string> = {
  mclaren: "McLaren",
  mercedes: "Mercedes",
  red_bull: "Red Bull Racing",
  ferrari: "Ferrari",
  williams: "Williams",
  rb: "Racing Bulls",
  aston_martin: "Aston Martin",
  haas: "Haas F1 Team",
  sauber: "Audi",
  kick_sauber: "Audi",
  alpine: "Alpine",
  cadillac: "Cadillac",
}

function resolveTeamName(constructorId: string, constructorName: string): string {
  return CONSTRUCTOR_ALIAS[constructorId] ?? constructorName
}

function safeInt(value: string, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

export interface StandingSyncResult {
  driversUpdated: number
  driversSkipped: string[]
  teamsUpdated: number
  teamsSkipped: string[]
}

export async function syncDriverStandings(standings: JolpicaDriverStanding[]): Promise<{ updated: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { updated: 0, skipped: [] }
  }

  let updated = 0
  const skipped: string[] = []

  for (let i = 0; i < standings.length; i++) {
    const entry = standings[i]
    const code = entry.Driver.code

    if (!code) {
      skipped.push(`${entry.Driver.givenName} ${entry.Driver.familyName} (no code)`)
      continue
    }

    // Jolpica sometimes omits `position` — fall back to positionText, then to array index
    const position = safeInt(entry.position ?? entry.positionText, i + 1)
    const points = safeInt(entry.points)
    const wins = safeInt(entry.wins)

    const setClauses: Record<string, unknown> = {
      position,
      points,
      wins,
      updatedAt: sql`now()`,
    }

    if (entry.Driver.dateOfBirth) {
      setClauses.dob = entry.Driver.dateOfBirth
    }

    if (entry.Driver.nationality) {
      setClauses.nationality = entry.Driver.nationality
    }

    const result = await db
      .update(drivers)
      .set(setClauses)
      .where(eq(drivers.code, code))
      .returning({ id: drivers.id })

    if (result.length > 0) {
      updated++
    } else {
      skipped.push(`${code} (not found in DB)`)
    }
  }

  return { updated, skipped }
}

export async function syncConstructorStandings(standings: JolpicaConstructorStanding[]): Promise<{ updated: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { updated: 0, skipped: [] }
  }

  let updated = 0
  const skipped: string[] = []

  for (let i = 0; i < standings.length; i++) {
    const entry = standings[i]
    const teamName = resolveTeamName(entry.Constructor.constructorId, entry.Constructor.name)
    // Jolpica sometimes omits `position` — fall back to positionText, then to array index
    const position = safeInt(entry.position ?? entry.positionText, i + 1)
    const points = safeInt(entry.points)
    const wins = safeInt(entry.wins)

    const result = await db
      .update(teams)
      .set({
        position,
        points,
        wins,
        updatedAt: sql`now()`,
      })
      .where(eq(teams.name, teamName))
      .returning({ id: teams.id })

    if (result.length > 0) {
      updated++
    } else {
      skipped.push(`${entry.Constructor.name} → ${teamName} (not found in DB)`)
    }
  }

  return { updated, skipped }
}

export async function syncPodiumsFromResults(results: JolpicaRaceResult[]): Promise<{ driversUpdated: number }> {
  const db = getDb()

  if (!db) {
    return { driversUpdated: 0 }
  }

  let driversUpdated = 0

  for (const result of results) {
    const pos = safeInt(result.position)

    if (pos === 0 || pos > 3) continue

    const code = result.Driver.code

    if (!code) continue

    const updated = await db
      .update(drivers)
      .set({
        podiums: sql`${drivers.podiums} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(drivers.code, code))
      .returning({ id: drivers.id })

    if (updated.length > 0) {
      driversUpdated++
    }
  }

  // Also update team podiums for top 3 finishers
  for (const result of results) {
    const pos = safeInt(result.position)

    if (pos === 0 || pos > 3) continue

    const teamName = resolveTeamName(result.Constructor.constructorId, result.Constructor.name)

    await db
      .update(teams)
      .set({
        podiums: sql`${teams.podiums} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(teams.name, teamName))
  }

  return { driversUpdated }
}

export async function syncRaceResultsToSession(
  results: JolpicaRaceResult[],
  season: number,
  round: number,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { inserted: 0, skipped: [] }
  }

  const [weekend] = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return { inserted: 0, skipped: [`Weekend not found for ${season} R${round}`] }
  }

  const [raceSession] = await db
    .select({ id: raceSessions.id })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionCode, "R")))
    .limit(1)

  if (!raceSession) {
    return { inserted: 0, skipped: [`Race session not found for ${season} R${round}`] }
  }

  await db.delete(sessionResults).where(eq(sessionResults.sessionId, raceSession.id))

  let inserted = 0
  const skipped: string[] = []

  for (const result of results) {
    const code = result.Driver.code
    if (!code) {
      skipped.push(`${result.Driver.givenName} ${result.Driver.familyName} (no code)`)
      continue
    }

    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.code, code))
      .limit(1)

    if (!driver) {
      skipped.push(`${code} (not found in DB)`)
      continue
    }

    const position = Number(result.position) || 0
    const points = Number(result.points) || 0
    const gapToLeader = result.Time?.time
      ? position === 1
        ? result.Time.time
        : `+${result.Time.time}`
      : null
    const status = result.status === "Finished" ? "finished" : result.status.toLowerCase()

    await db.insert(sessionResults).values({
      sessionId: raceSession.id,
      driverId: driver.id,
      position,
      bestLapTime: result.FastestLap?.Time?.time ?? null,
      gapToLeader,
      points,
      status,
      gridPosition: Number(result.grid) || null,
      lapsCompleted: Number(result.laps) || null,
      fastestLapRank: result.FastestLap ? (Number(result.FastestLap.rank) || null) : null,
    })

    inserted++
  }

  return { inserted, skipped }
}

const DNF_STATUSES = new Set(["finished", "lapped"])

function isDnf(status: string): boolean {
  const lower = status.toLowerCase()
  return !DNF_STATUSES.has(lower) && !lower.startsWith("+")
}

export async function syncDriverStatsFromResults(results: JolpicaRaceResult[]): Promise<{ updated: number }> {
  const db = getDb()

  if (!db) {
    return { updated: 0 }
  }

  let updated = 0

  for (const result of results) {
    const code = result.Driver.code
    if (!code) continue

    const position = safeInt(result.position)
    const grid = safeInt(result.grid)
    const didDnf = isDnf(result.status)
    const isPole = grid === 1
    const didStart = result.status !== "DNS"

    const setClauses: Record<string, ReturnType<typeof sql>> = {
      updatedAt: sql`now()`,
    }

    if (didStart) {
      setClauses.gpEntered = sql`${drivers.gpEntered} + 1`
    }

    if (didDnf) {
      setClauses.dnfs = sql`${drivers.dnfs} + 1`
    }

    if (isPole) {
      setClauses.poles = sql`${drivers.poles} + 1`
    }

    if (position > 0) {
      setClauses.bestFinish = sql`
        CASE
          WHEN ${drivers.bestFinish} = '—' THEN ${String(position)}
          WHEN ${drivers.bestFinish} ~ '^\d+$' AND ${position} < ${drivers.bestFinish}::int THEN ${String(position)}
          ELSE ${drivers.bestFinish}
        END
      `
    }

    if (grid > 0) {
      setClauses.bestGrid = sql`
        CASE
          WHEN ${drivers.bestGrid} = '—' THEN ${String(grid)}
          WHEN ${drivers.bestGrid} ~ '^\d+$' AND ${grid} < ${drivers.bestGrid}::int THEN ${String(grid)}
          ELSE ${drivers.bestGrid}
        END
      `
    }

    const rows = await db
      .update(drivers)
      .set(setClauses)
      .where(eq(drivers.code, code))
      .returning({ id: drivers.id })

    if (rows.length > 0) {
      updated++
    }
  }

  return { updated }
}

export async function syncQualifyingResultsToSession(
  results: JolpicaQualifyingResult[],
  season: number,
  round: number,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { inserted: 0, skipped: [] }
  }

  const [weekend] = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return { inserted: 0, skipped: [`Weekend not found for ${season} R${round}`] }
  }

  const [qualiSession] = await db
    .select({ id: raceSessions.id })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionCode, "Q")))
    .limit(1)

  if (!qualiSession) {
    return { inserted: 0, skipped: [`Qualifying session not found for ${season} R${round}`] }
  }

  await db.delete(sessionResults).where(eq(sessionResults.sessionId, qualiSession.id))

  let inserted = 0
  const skipped: string[] = []

  for (const result of results) {
    const code = result.Driver.code
    if (!code) {
      skipped.push(`${result.Driver.givenName} ${result.Driver.familyName} (no code)`)
      continue
    }

    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.code, code))
      .limit(1)

    if (!driver) {
      skipped.push(`${code} (not found in DB)`)
      continue
    }

    const position = Number(result.position) || 0

    await db.insert(sessionResults).values({
      sessionId: qualiSession.id,
      driverId: driver.id,
      position,
      q1Time: result.Q1 ?? null,
      q2Time: result.Q2 ?? null,
      q3Time: result.Q3 ?? null,
    })

    inserted++
  }

  return { inserted, skipped }
}

export async function syncSprintResultsToSession(
  results: JolpicaRaceResult[],
  season: number,
  round: number,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { inserted: 0, skipped: [] }
  }

  const [weekend] = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return { inserted: 0, skipped: [`Weekend not found for ${season} R${round}`] }
  }

  const [sprintSession] = await db
    .select({ id: raceSessions.id })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionCode, "SPR")))
    .limit(1)

  if (!sprintSession) {
    return { inserted: 0, skipped: [`Sprint session not found for ${season} R${round}`] }
  }

  await db.delete(sessionResults).where(eq(sessionResults.sessionId, sprintSession.id))

  let inserted = 0
  const skipped: string[] = []

  for (const result of results) {
    const code = result.Driver.code
    if (!code) {
      skipped.push(`${result.Driver.givenName} ${result.Driver.familyName} (no code)`)
      continue
    }

    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.code, code))
      .limit(1)

    if (!driver) {
      skipped.push(`${code} (not found in DB)`)
      continue
    }

    const position = Number(result.position) || 0
    const points = Number(result.points) || 0
    const gapToLeader = result.Time?.time
      ? position === 1
        ? result.Time.time
        : `+${result.Time.time}`
      : null
    const status = result.status === "Finished" ? "finished" : result.status.toLowerCase()

    await db.insert(sessionResults).values({
      sessionId: sprintSession.id,
      driverId: driver.id,
      position,
      bestLapTime: result.FastestLap?.Time?.time ?? null,
      gapToLeader,
      points,
      status,
      gridPosition: Number(result.grid) || null,
      lapsCompleted: Number(result.laps) || null,
      fastestLapRank: result.FastestLap ? (Number(result.FastestLap.rank) || null) : null,
    })

    inserted++
  }

  return { inserted, skipped }
}

export async function syncLapSummaries(
  laps: JolpicaLap[],
  season: number,
  round: number,
  driverIdToCode: Map<string, string>,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { inserted: 0, skipped: [] }
  }

  const [weekend] = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return { inserted: 0, skipped: [`Weekend not found for ${season} R${round}`] }
  }

  const [raceSession] = await db
    .select({ id: raceSessions.id, startTimeUtc: raceSessions.startTimeUtc })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionCode, "R")))
    .limit(1)

  if (!raceSession) {
    return { inserted: 0, skipped: [`Race session not found for ${season} R${round}`] }
  }

  const allDrivers = await db
    .select({ id: drivers.id, code: drivers.code })
    .from(drivers)

  const codeToDbId = new Map(allDrivers.map((d) => [d.code.toUpperCase(), d.id]))

  await db.delete(lapSummaries).where(eq(lapSummaries.sessionId, raceSession.id))

  let inserted = 0
  const skipped = new Set<string>()
  const baseTime = raceSession.startTimeUtc

  const batch: (typeof lapSummaries.$inferInsert)[] = []

  for (const lap of laps) {
    const lapNumber = Number(lap.number) || 0
    const lapTimestamp = new Date(baseTime.getTime() + lapNumber * 90_000)

    for (const timing of lap.Timings) {
      const code = driverIdToCode.get(timing.driverId)
      const driverId = code ? codeToDbId.get(code.toUpperCase()) : undefined

      if (!driverId) {
        skipped.add(timing.driverId)
        continue
      }

      batch.push({
        sessionId: raceSession.id,
        driverId,
        lapNumber,
        lapTime: timing.time || null,
        occurredAtUtc: lapTimestamp,
      })
      inserted++
    }
  }

  if (batch.length > 0) {
    const CHUNK_SIZE = 500
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      await db.insert(lapSummaries).values(batch.slice(i, i + CHUNK_SIZE))
    }
  }

  return { inserted, skipped: Array.from(skipped) }
}

export async function syncPitStops(
  stops: JolpicaPitStop[],
  season: number,
  round: number,
  driverIdToCode: Map<string, string>,
): Promise<{ inserted: number; skipped: string[] }> {
  const db = getDb()

  if (!db) {
    return { inserted: 0, skipped: [] }
  }

  const [weekend] = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return { inserted: 0, skipped: [`Weekend not found for ${season} R${round}`] }
  }

  const [raceSession] = await db
    .select({ id: raceSessions.id })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionCode, "R")))
    .limit(1)

  if (!raceSession) {
    return { inserted: 0, skipped: [`Race session not found for ${season} R${round}`] }
  }

  const allDrivers = await db.select({ id: drivers.id, code: drivers.code }).from(drivers)
  const codeToDbId = new Map(allDrivers.map((d) => [d.code.toUpperCase(), d.id]))

  await db.delete(pitStops).where(eq(pitStops.sessionId, raceSession.id))

  let inserted = 0
  const skipped = new Set<string>()

  for (const stop of stops) {
    const code = driverIdToCode.get(stop.driverId)
    const driverId = code ? codeToDbId.get(code.toUpperCase()) : undefined

    if (!driverId) {
      skipped.add(stop.driverId)
      continue
    }

    await db.insert(pitStops).values({
      sessionId: raceSession.id,
      driverId,
      lap: Number(stop.lap) || 0,
      stopNumber: Number(stop.stop) || 0,
      duration: stop.duration || null,
      timeOfDay: stop.time || null,
    })

    inserted++
  }

  return { inserted, skipped: Array.from(skipped) }
}

export async function syncCircuits(
  races: JolpicaScheduleRace[],
): Promise<{ circuitsUpserted: number; weekendsLinked: number }> {
  const db = getDb()

  if (!db) {
    return { circuitsUpserted: 0, weekendsLinked: 0 }
  }

  let circuitsUpserted = 0
  let weekendsLinked = 0

  for (const race of races) {
    const c = race.Circuit
    const lat = parseFloat(c.Location.lat) || null
    const lng = parseFloat(c.Location.long) || null

    const [existing] = await db
      .select({ id: circuits.id })
      .from(circuits)
      .where(eq(circuits.circuitId, c.circuitId))
      .limit(1)

    if (existing) {
      await db
        .update(circuits)
        .set({ name: c.circuitName, locality: c.Location.locality, country: c.Location.country, lat, lng, wikiUrl: c.url || null })
        .where(eq(circuits.circuitId, c.circuitId))
    } else {
      await db.insert(circuits).values({
        circuitId: c.circuitId,
        name: c.circuitName,
        locality: c.Location.locality,
        country: c.Location.country,
        lat,
        lng,
        wikiUrl: c.url || null,
      })
    }
    circuitsUpserted++

    const seasonNum = Number(race.season)
    const roundNum = Number(race.round)

    if (isNaN(seasonNum) || isNaN(roundNum)) continue

    const updated = await db
      .update(raceWeekends)
      .set({ circuitRef: c.circuitId })
      .where(and(eq(raceWeekends.season, seasonNum), eq(raceWeekends.round, roundNum)))
      .returning({ id: raceWeekends.id })

    if (updated.length > 0) {
      weekendsLinked++
    }
  }

  return { circuitsUpserted, weekendsLinked }
}

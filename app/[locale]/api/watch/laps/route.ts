import { NextResponse } from "next/server"
import { getDb } from "@/lib/db/client"
import { drivers, lapSummaries, pitStops, raceIntervals, raceSessions, raceWeekends, sessionResults, sessionWeather, teams, tireStints } from "@/lib/db/schema"
import { fetchLaps, findSession } from "@/lib/openf1/client"
import { asc, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

const SESSION_TYPE_TO_OPENF1_NAME: Record<string, string> = {
  race: "Race",
  qualifying: "Qualifying",
  sprint: "Sprint",
  sprint_qualifying: "Sprint Qualifying",
  practice1: "Practice 1",
  practice2: "Practice 2",
  practice3: "Practice 3",
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const sessionId = parseInt(searchParams.get("sessionId") ?? "", 10)
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })

  const db = getDb()
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 })

  const [sessionRows, lapRows, intervalRows, resultRows, tireStintRows, pitStopRows, weatherRows] = await Promise.all([
    db
      .select({
        id: raceSessions.id,
        sessionType: raceSessions.sessionType,
        sessionCode: raceSessions.sessionCode,
        startTimeUtc: raceSessions.startTimeUtc,
        grandPrixName: raceWeekends.grandPrixName,
        season: raceWeekends.season,
        round: raceWeekends.round,
        country: raceWeekends.country,
        circuit: raceWeekends.circuit,
      })
      .from(raceSessions)
      .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
      .where(eq(raceSessions.id, sessionId))
      .limit(1),

    db
      .select({
        driverId: lapSummaries.driverId,
        driverCode: drivers.code,
        driverNumber: drivers.driverNumber,
        fullName: drivers.fullName,
        teamColor: teams.color,
        lapNumber: lapSummaries.lapNumber,
        lapTime: lapSummaries.lapTime,
        sector1: lapSummaries.sector1,
        sector2: lapSummaries.sector2,
        sector3: lapSummaries.sector3,
        i1Speed: lapSummaries.i1Speed,
        i2Speed: lapSummaries.i2Speed,
        stSpeed: lapSummaries.stSpeed,
        compound: lapSummaries.compound,
        pitIn: lapSummaries.pitIn,
        pitOut: lapSummaries.pitOut,
        occurredAtUtc: lapSummaries.occurredAtUtc,
      })
      .from(lapSummaries)
      .innerJoin(drivers, eq(lapSummaries.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(eq(lapSummaries.sessionId, sessionId))
      .orderBy(asc(lapSummaries.occurredAtUtc)),

    db
      .select({
        driverId: raceIntervals.driverId,
        driverCode: drivers.code,
        lapNumber: raceIntervals.lapNumber,
        gapToLeader: raceIntervals.gapToLeader,
        intervalToAhead: raceIntervals.intervalToAhead,
      })
      .from(raceIntervals)
      .innerJoin(drivers, eq(raceIntervals.driverId, drivers.id))
      .where(eq(raceIntervals.sessionId, sessionId))
      .orderBy(asc(raceIntervals.lapNumber)),

    db
      .select({
        driverId: sessionResults.driverId,
        driverCode: drivers.code,
        position: sessionResults.position,
        gridPosition: sessionResults.gridPosition,
        lapsCompleted: sessionResults.lapsCompleted,
        gapToLeader: sessionResults.gapToLeader,
        status: sessionResults.status,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .where(eq(sessionResults.sessionId, sessionId))
      .orderBy(asc(sessionResults.position)),

    db
      .select({
        driverCode: drivers.code,
        stintNumber: tireStints.stintNumber,
        compound: tireStints.compound,
        lapStart: tireStints.lapStart,
        lapEnd: tireStints.lapEnd,
        tyreAgeAtStart: tireStints.tyreAgeAtStart,
      })
      .from(tireStints)
      .innerJoin(drivers, eq(tireStints.driverId, drivers.id))
      .where(eq(tireStints.sessionId, sessionId))
      .orderBy(asc(tireStints.stintNumber)),

    db
      .select({
        driverCode: drivers.code,
        lap: pitStops.lap,
        stopNumber: pitStops.stopNumber,
        duration: pitStops.duration,
      })
      .from(pitStops)
      .innerJoin(drivers, eq(pitStops.driverId, drivers.id))
      .where(eq(pitStops.sessionId, sessionId))
      .orderBy(asc(pitStops.lap)),

    db
      .select({
        airTemperature: sessionWeather.airTemperature,
        trackTemperature: sessionWeather.trackTemperature,
        humidity: sessionWeather.humidity,
        rainfall: sessionWeather.rainfall,
        windSpeed: sessionWeather.windSpeed,
        windDirection: sessionWeather.windDirection,
        recordedAtUtc: sessionWeather.recordedAtUtc,
      })
      .from(sessionWeather)
      .where(eq(sessionWeather.sessionId, sessionId))
      .orderBy(asc(sessionWeather.recordedAtUtc)),
  ])

  if (!sessionRows[0]) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const session = sessionRows[0]

  // Build a lookup map: driverNumber → lapNumber → date_start from OpenF1
  // date_start is a precise UTC timestamp directly from the timing loop — zero drift
  const openf1DateStartMap = new Map<number, Map<number, string>>()
  try {
    const openf1SessionName = SESSION_TYPE_TO_OPENF1_NAME[session.sessionType.toLowerCase()] ?? null
    if (openf1SessionName && session.country) {
      const matched = await findSession({
        year: session.season,
        sessionName: openf1SessionName,
        countryName: session.country,
        circuitName: session.circuit,
        startTimeUtc: session.startTimeUtc,
      })
      if (matched) {
        const openf1Laps = await fetchLaps(matched.session_key)
        for (const lap of openf1Laps) {
          if (!lap.date_start) continue
          if (!openf1DateStartMap.has(lap.driver_number)) {
            openf1DateStartMap.set(lap.driver_number, new Map())
          }
          openf1DateStartMap.get(lap.driver_number)!.set(lap.lap_number, lap.date_start)
        }
      }
    }
  } catch {
    // OpenF1 is non-critical — continue with DB data only
  }

  const lapsWithOpenF1 = lapRows.map((lap) => ({
    ...lap,
    openf1DateStart: openf1DateStartMap.get(Number(lap.driverNumber))?.get(lap.lapNumber) ?? null,
  }))

  return NextResponse.json({
    session,
    laps: lapsWithOpenF1,
    intervals: intervalRows,
    results: resultRows,
    tireStints: tireStintRows,
    pitStops: pitStopRows,
    weather: weatherRows,
  })
}

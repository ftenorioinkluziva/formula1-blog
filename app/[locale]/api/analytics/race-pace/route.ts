import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, lapSummaries, pitStops, raceControlMessages, teamRadio, teams, tireStints } from "@/lib/db/schema"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import { parseLapTimeToMs, parseDurationToMs } from "@/lib/analytics/lap-time-parser"
import type { RacePaceResponse, DriverInfo } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const sessionId = await resolveSessionId(season, round, "R")
    if (!sessionId) {
      return NextResponse.json({ error: "Race session not found" }, { status: 404 })
    }

    const db = getDb()!

    const [lapRows, pitRows, stintRows, rcRows, radioRows] = await Promise.all([
      db
        .select({
          driverId: lapSummaries.driverId,
          lapNumber: lapSummaries.lapNumber,
          lapTime: lapSummaries.lapTime,
          pitIn: lapSummaries.pitIn,
          pitOut: lapSummaries.pitOut,
          compound: lapSummaries.compound,
          driverCode: drivers.code,
          driverNumber: drivers.driverNumber,
          driverFullName: drivers.fullName,
          teamName: teams.name,
          teamColor: teams.color,
        })
        .from(lapSummaries)
        .innerJoin(drivers, eq(lapSummaries.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(lapSummaries.sessionId, sessionId))
        .orderBy(asc(lapSummaries.lapNumber), asc(drivers.driverNumber)),

      db
        .select({
          driverId: pitStops.driverId,
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
          driverId: tireStints.driverId,
          stintNumber: tireStints.stintNumber,
          compound: tireStints.compound,
          lapStart: tireStints.lapStart,
          lapEnd: tireStints.lapEnd,
          tyreAgeAtStart: tireStints.tyreAgeAtStart,
          driverCode: drivers.code,
        })
        .from(tireStints)
        .innerJoin(drivers, eq(tireStints.driverId, drivers.id))
        .where(eq(tireStints.sessionId, sessionId))
        .orderBy(asc(tireStints.driverId), asc(tireStints.stintNumber)),

      db
        .select({
          lap: raceControlMessages.lap,
          flag: raceControlMessages.flag,
          messageType: raceControlMessages.messageType,
          messageText: raceControlMessages.messageText,
          occurredAtUtc: raceControlMessages.occurredAtUtc,
        })
        .from(raceControlMessages)
        .where(eq(raceControlMessages.sessionId, sessionId))
        .orderBy(asc(raceControlMessages.occurredAtUtc)),

      db
        .select({
          driverCode: drivers.code,
          teamColor: teams.color,
          lap: teamRadio.lap,
          recordingUrl: teamRadio.recordingUrl,
          occurredAtUtc: teamRadio.occurredAtUtc,
        })
        .from(teamRadio)
        .innerJoin(drivers, eq(teamRadio.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(teamRadio.sessionId, sessionId))
        .orderBy(asc(teamRadio.occurredAtUtc)),
    ])

    const driverMap = new Map<number, DriverInfo>()
    let maxLap = 0

    const laps = lapRows
      .map((row) => {
        if (!driverMap.has(row.driverId)) {
          driverMap.set(row.driverId, {
            id: row.driverId,
            code: row.driverCode,
            fullName: row.driverFullName,
            number: row.driverNumber,
            teamName: row.teamName,
            teamColor: row.teamColor,
          })
        }
        if (row.lapNumber > maxLap) maxLap = row.lapNumber

        const lapTimeMs = parseLapTimeToMs(row.lapTime)
        if (lapTimeMs === null) return null

        return {
          driverId: row.driverId,
          driverCode: row.driverCode,
          teamColor: row.teamColor,
          lapNumber: row.lapNumber,
          lapTimeMs,
          pitIn: row.pitIn,
          pitOut: row.pitOut,
          compound: row.compound,
        }
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)

    const response: RacePaceResponse = {
      sessionId,
      totalLaps: maxLap,
      drivers: Array.from(driverMap.values()),
      laps,
      pitStops: pitRows.map((row) => ({
        driverId: row.driverId,
        driverCode: row.driverCode,
        lap: row.lap,
        stopNumber: row.stopNumber,
        durationMs: parseDurationToMs(row.duration),
      })),
      stints: stintRows.map((row) => ({
        driverId: row.driverId,
        driverCode: row.driverCode,
        stintNumber: row.stintNumber,
        compound: row.compound,
        lapStart: row.lapStart,
        lapEnd: row.lapEnd,
        tyreAgeAtStart: row.tyreAgeAtStart,
      })),
      raceControlEvents: rcRows
        .filter((r) => r.lap >= 0)
        .map((r) => ({
          lap: r.lap,
          flag: r.flag,
          messageType: r.messageType,
          message: r.messageText,
          occurredAtUtc: r.occurredAtUtc.toISOString(),
        })),
      teamRadio: radioRows.map((r) => ({
        driverCode: r.driverCode,
        teamColor: r.teamColor,
        lap: r.lap,
        recordingUrl: r.recordingUrl,
        occurredAtUtc: r.occurredAtUtc.toISOString(),
      })),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[race-pace]", err)
    return NextResponse.json({ error: "Failed to fetch race pace data" }, { status: 500 })
  }
}

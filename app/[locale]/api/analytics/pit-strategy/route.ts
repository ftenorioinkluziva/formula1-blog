import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, pitStops, sessionResults, teams, tireStints } from "@/lib/db/schema"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import { parseDurationToMs } from "@/lib/analytics/lap-time-parser"
import type { PitStrategyResponse, PitStrategyDriver } from "@/lib/analytics/types"

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

    const [pitRows, resultRows, stintRows] = await Promise.all([
      db
        .select({
          driverId: pitStops.driverId,
          driverCode: drivers.code,
          fullName: drivers.fullName,
          teamColor: teams.color,
          lap: pitStops.lap,
          stopNumber: pitStops.stopNumber,
          duration: pitStops.duration,
        })
        .from(pitStops)
        .innerJoin(drivers, eq(pitStops.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(pitStops.sessionId, sessionId))
        .orderBy(asc(pitStops.driverId), asc(pitStops.stopNumber)),

      db
        .select({
          driverId: sessionResults.driverId,
          position: sessionResults.position,
          lapsCompleted: sessionResults.lapsCompleted,
          driverCode: drivers.code,
          fullName: drivers.fullName,
          teamColor: teams.color,
        })
        .from(sessionResults)
        .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(sessionResults.sessionId, sessionId))
        .orderBy(asc(sessionResults.position)),

      db
        .select({
          driverId: tireStints.driverId,
          stintNumber: tireStints.stintNumber,
          compound: tireStints.compound,
          lapStart: tireStints.lapStart,
          lapEnd: tireStints.lapEnd,
        })
        .from(tireStints)
        .where(eq(tireStints.sessionId, sessionId))
        .orderBy(asc(tireStints.driverId), asc(tireStints.stintNumber)),
    ])

    const maxLaps = Math.max(...resultRows.map((r) => r.lapsCompleted ?? 0), 0)

    const pitByDriver = new Map<number, typeof pitRows>()
    for (const row of pitRows) {
      const arr = pitByDriver.get(row.driverId) ?? []
      arr.push(row)
      pitByDriver.set(row.driverId, arr)
    }

    const stintsByDriver = new Map<number, typeof stintRows>()
    for (const row of stintRows) {
      const arr = stintsByDriver.get(row.driverId) ?? []
      arr.push(row)
      stintsByDriver.set(row.driverId, arr)
    }

    const driverStrategies: PitStrategyDriver[] = resultRows.map((result) => {
      const driverPits = pitByDriver.get(result.driverId) ?? []
      const driverTireStints = stintsByDriver.get(result.driverId)
      const totalLaps = result.lapsCompleted ?? maxLaps

      const stops = driverPits.map((p) => ({
        lap: p.lap,
        stopNumber: p.stopNumber,
        durationMs: parseDurationToMs(p.duration),
      }))

      if (driverTireStints && driverTireStints.length > 0) {
        const stints = driverTireStints.map((s) => ({
          startLap: s.lapStart,
          endLap: Math.min(s.lapEnd, totalLaps),
          laps: Math.min(s.lapEnd, totalLaps) - s.lapStart + 1,
          compound: s.compound,
        }))

        return {
          driverId: result.driverId,
          driverCode: result.driverCode,
          fullName: result.fullName,
          teamColor: result.teamColor,
          finishPosition: result.position,
          stops,
          stints,
        }
      }

      const pitLaps = driverPits.map((p) => p.lap).sort((a, b) => a - b)
      const stints: Array<{ startLap: number; endLap: number; laps: number; compound: string | null }> = []
      let stintStart = 1

      for (const pitLap of pitLaps) {
        stints.push({ startLap: stintStart, endLap: pitLap, laps: pitLap - stintStart + 1, compound: null })
        stintStart = pitLap + 1
      }

      if (stintStart <= totalLaps) {
        stints.push({ startLap: stintStart, endLap: totalLaps, laps: totalLaps - stintStart + 1, compound: null })
      }

      return {
        driverId: result.driverId,
        driverCode: result.driverCode,
        fullName: result.fullName,
        teamColor: result.teamColor,
        finishPosition: result.position,
        stops,
        stints,
      }
    })

    const response: PitStrategyResponse = {
      sessionId,
      totalLaps: maxLaps,
      drivers: driverStrategies,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Failed to fetch pit strategy data" }, { status: 500 })
  }
}

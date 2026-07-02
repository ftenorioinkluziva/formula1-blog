import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, raceIntervals, lapSummaries, raceControlMessages, sessionResults, teams } from "@/lib/db/schema"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import type { GapEvolutionResponse, DriverInfo } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

type IntervalRow = {
  driverId: number
  lapNumber: number
  gapToLeader: number | null
  driverCode: string
  driverFullName: string
  driverNumber: number
  teamName: string
  teamColor: string
}

type LapRow = {
  driverId: number
  lapNumber: number
  occurredAtUtc: Date
  driverCode: string
  driverFullName: string
  driverNumber: number
  teamName: string
  teamColor: string
}

function buildGapRowsFromLapSummaries(lapRows: LapRow[]): IntervalRow[] {
  const leaderTimeByLap = new Map<number, number>()

  for (const row of lapRows) {
    const timestamp = row.occurredAtUtc.getTime()
    const currentLeaderTime = leaderTimeByLap.get(row.lapNumber)

    if (currentLeaderTime === undefined || timestamp < currentLeaderTime) {
      leaderTimeByLap.set(row.lapNumber, timestamp)
    }
  }

  return lapRows.map((row) => {
    const leaderTime = leaderTimeByLap.get(row.lapNumber)
    const gapToLeader = leaderTime === undefined
      ? null
      : Number(((row.occurredAtUtc.getTime() - leaderTime) / 1000).toFixed(3))

    return {
      driverId: row.driverId,
      lapNumber: row.lapNumber,
      gapToLeader,
      driverCode: row.driverCode,
      driverFullName: row.driverFullName,
      driverNumber: row.driverNumber,
      teamName: row.teamName,
      teamColor: row.teamColor,
    }
  })
}

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

    const [intervalRows, lapCountRows, rcRows, resultRows] = await Promise.all([
      db
        .select({
          driverId: raceIntervals.driverId,
          lapNumber: raceIntervals.lapNumber,
          gapToLeader: raceIntervals.gapToLeader,
          driverCode: drivers.code,
          driverFullName: drivers.fullName,
          driverNumber: drivers.driverNumber,
          teamName: teams.name,
          teamColor: teams.color,
        })
        .from(raceIntervals)
        .innerJoin(drivers, eq(raceIntervals.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(raceIntervals.sessionId, sessionId))
        .orderBy(asc(raceIntervals.lapNumber), asc(drivers.driverNumber)),

      db
        .select({
          driverId: lapSummaries.driverId,
          lapNumber: lapSummaries.lapNumber,
          occurredAtUtc: lapSummaries.occurredAtUtc,
          driverCode: drivers.code,
          driverFullName: drivers.fullName,
          driverNumber: drivers.driverNumber,
          teamName: teams.name,
          teamColor: teams.color,
        })
        .from(lapSummaries)
        .innerJoin(drivers, eq(lapSummaries.driverId, drivers.id))
        .innerJoin(teams, eq(drivers.teamId, teams.id))
        .where(eq(lapSummaries.sessionId, sessionId))
        .orderBy(asc(lapSummaries.lapNumber), asc(lapSummaries.occurredAtUtc)),

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
          driverId: sessionResults.driverId,
          position: sessionResults.position,
        })
        .from(sessionResults)
        .where(eq(sessionResults.sessionId, sessionId))
        .orderBy(asc(sessionResults.position)),
    ])

    const effectiveIntervalRows = intervalRows.length > 0
      ? intervalRows
      : buildGapRowsFromLapSummaries(lapCountRows)

    const totalLaps = lapCountRows.length > 0
      ? Math.max(...lapCountRows.map((r) => r.lapNumber))
      : Math.max(...effectiveIntervalRows.map((r) => r.lapNumber), 0)

    const driverMap = new Map<number, DriverInfo>()
    const gaps = effectiveIntervalRows.map((row) => {
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
      return {
        driverId: row.driverId,
        driverCode: row.driverCode,
        teamColor: row.teamColor,
        lapNumber: row.lapNumber,
        gapToLeader: row.gapToLeader,
      }
    })

    const finishPositionByDriverId = new Map(resultRows.map((row) => [row.driverId, row.position]))
    const orderedDrivers = Array.from(driverMap.values()).sort((left, right) => {
      const leftPosition = finishPositionByDriverId.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPosition = finishPositionByDriverId.get(right.id) ?? Number.MAX_SAFE_INTEGER

      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition
      }

      return left.number - right.number
    })

    const response: GapEvolutionResponse = {
      sessionId,
      totalLaps,
      drivers: orderedDrivers,
      gaps,
      raceControlEvents: rcRows
        .filter((r) => r.lap >= 0)
        .map((r) => ({
          lap: r.lap,
          flag: r.flag,
          messageType: r.messageType,
          message: r.messageText,
          occurredAtUtc: r.occurredAtUtc.toISOString(),
        })),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[gap-evolution]", err)
    return NextResponse.json({ error: "Failed to fetch gap evolution data" }, { status: 500 })
  }
}

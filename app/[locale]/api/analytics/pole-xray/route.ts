import { NextResponse } from "next/server"
import { asc, eq, and } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { carTelemetry, drivers, lapSummaries, sessionResults, teams } from "@/lib/db/schema"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import { parseLapTimeToMs } from "@/lib/analytics/lap-time-parser"
import type { PoleXRayResponse } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const sessionId = await resolveSessionId(season, round, "Q")
    if (!sessionId) {
      return NextResponse.json({ error: "Qualifying session not found" }, { status: 404 })
    }

    const db = getDb()!

    const poleResult = await db
      .select({
        driverId: sessionResults.driverId,
        driverCode: drivers.code,
        fullName: drivers.fullName,
        teamColor: teams.color,
        q3Time: sessionResults.q3Time,
        q2Time: sessionResults.q2Time,
        q1Time: sessionResults.q1Time,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(and(eq(sessionResults.sessionId, sessionId), eq(sessionResults.position, 1)))
      .limit(1)

    if (poleResult.length === 0) {
      return NextResponse.json({ error: "No pole position result found" }, { status: 404 })
    }

    const pole = poleResult[0]
    const lapTimeMs = parseLapTimeToMs(pole.q3Time) ?? parseLapTimeToMs(pole.q2Time) ?? parseLapTimeToMs(pole.q1Time)

    const telemetryRows = await db
      .select({
        sampleIndex: carTelemetry.sampleIndex,
        speed: carTelemetry.speed,
        throttle: carTelemetry.throttle,
        brake: carTelemetry.brake,
        rpm: carTelemetry.rpm,
        gear: carTelemetry.gear,
        drs: carTelemetry.drs,
        recordedAtUtc: carTelemetry.recordedAtUtc,
      })
      .from(carTelemetry)
      .where(
        and(
          eq(carTelemetry.sessionId, sessionId),
          eq(carTelemetry.driverId, pole.driverId),
        ),
      )
      .orderBy(asc(carTelemetry.sampleIndex))

    const lapRows = await db
      .select({
        lapNumber: lapSummaries.lapNumber,
        sector1: lapSummaries.sector1,
        sector2: lapSummaries.sector2,
        sector3: lapSummaries.sector3,
        lapTime: lapSummaries.lapTime,
      })
      .from(lapSummaries)
      .where(
        and(
          eq(lapSummaries.sessionId, sessionId),
          eq(lapSummaries.driverId, pole.driverId),
        ),
      )
      .orderBy(asc(lapSummaries.lapNumber))

    let sector1Ms: number | null = null
    let sector2Ms: number | null = null
    let sector3Ms: number | null = null
    let bestLapNumber = 1

    if (lapRows.length > 0) {
      const fastestLap = lapRows.reduce((best, row) => {
        const bestTime = parseLapTimeToMs(best.lapTime)
        const rowTime = parseLapTimeToMs(row.lapTime)
        if (rowTime === null) return best
        if (bestTime === null) return row
        return rowTime < bestTime ? row : best
      })
      sector1Ms = parseLapTimeToMs(fastestLap.sector1)
      sector2Ms = parseLapTimeToMs(fastestLap.sector2)
      sector3Ms = parseLapTimeToMs(fastestLap.sector3)
      bestLapNumber = fastestLap.lapNumber
    }

    const firstTs = telemetryRows[0]?.recordedAtUtc
    const telemetry = telemetryRows.map((row) => {
      const { recordedAtUtc, ...rest } = row
      const relativeMs =
        firstTs && recordedAtUtc
          ? new Date(recordedAtUtc).getTime() - new Date(firstTs).getTime()
          : null
      return { ...rest, relativeMs }
    })

    const response: PoleXRayResponse = {
      sessionId,
      driverCode: pole.driverCode,
      driverFullName: pole.fullName,
      teamColor: pole.teamColor,
      lapNumber: bestLapNumber,
      lapTimeMs,
      sector1Ms,
      sector2Ms,
      sector3Ms,
      telemetry,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Failed to fetch pole X-ray data" }, { status: 500 })
  }
}

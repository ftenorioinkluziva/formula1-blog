import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, sessionResults, teams } from "@/lib/db/schema"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import { parseLapTimeToMs } from "@/lib/analytics/lap-time-parser"
import type { QualifyingResponse } from "@/lib/analytics/types"

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

    const rows = await db
      .select({
        driverId: sessionResults.driverId,
        position: sessionResults.position,
        q1Time: sessionResults.q1Time,
        q2Time: sessionResults.q2Time,
        q3Time: sessionResults.q3Time,
        driverCode: drivers.code,
        fullName: drivers.fullName,
        teamColor: teams.color,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(eq(sessionResults.sessionId, sessionId))
      .orderBy(asc(sessionResults.position))

    const poleTimeMs = rows[0] ? (parseLapTimeToMs(rows[0].q3Time) ?? parseLapTimeToMs(rows[0].q2Time) ?? parseLapTimeToMs(rows[0].q1Time)) : null

    const response: QualifyingResponse = {
      sessionId,
      results: rows.map((r) => {
        const q3Ms = parseLapTimeToMs(r.q3Time)
        const q2Ms = parseLapTimeToMs(r.q2Time)
        const q1Ms = parseLapTimeToMs(r.q1Time)
        const bestMs = q3Ms ?? q2Ms ?? q1Ms

        return {
          driverId: r.driverId,
          driverCode: r.driverCode,
          fullName: r.fullName,
          teamColor: r.teamColor,
          position: r.position,
          q1TimeMs: q1Ms,
          q2TimeMs: q2Ms,
          q3TimeMs: q3Ms,
          gapToPoleMs: bestMs !== null && poleTimeMs !== null ? bestMs - poleTimeMs : null,
        }
      }),
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Failed to fetch qualifying data" }, { status: 500 })
  }
}

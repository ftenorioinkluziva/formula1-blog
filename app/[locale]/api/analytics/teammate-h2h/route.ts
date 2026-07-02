import { NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, raceSessions, raceWeekends, sessionResults, teams } from "@/lib/db/schema"
import { parseLapTimeToMs } from "@/lib/analytics/lap-time-parser"
import type { TeammateH2HResponse, TeammateH2HTeam } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? new Date().getFullYear().toString(), 10)

    const db = getDb()!

    const weekends = await db
      .select({ id: raceWeekends.id })
      .from(raceWeekends)
      .where(eq(raceWeekends.season, season))

    if (!weekends.length) {
      return NextResponse.json({ error: "No weekends found" }, { status: 404 })
    }

    const weekendIds = weekends.map((w) => w.id)

    const sessions = await db
      .select({ id: raceSessions.id, weekendId: raceSessions.weekendId, sessionCode: raceSessions.sessionCode })
      .from(raceSessions)
      .where(and(inArray(raceSessions.weekendId, weekendIds), inArray(raceSessions.sessionCode, ["R", "Q"])))

    const raceSessionIds = sessions.filter((s) => s.sessionCode === "R").map((s) => s.id)
    const qualiSessionIds = sessions.filter((s) => s.sessionCode === "Q").map((s) => s.id)

    const allSessionIds = [...raceSessionIds, ...qualiSessionIds]
    if (!allSessionIds.length) {
      return NextResponse.json({ season, teams: [] } satisfies TeammateH2HResponse)
    }

    const results = await db
      .select({
        sessionId: sessionResults.sessionId,
        driverId: sessionResults.driverId,
        position: sessionResults.position,
        points: sessionResults.points,
        q1Time: sessionResults.q1Time,
        q2Time: sessionResults.q2Time,
        q3Time: sessionResults.q3Time,
        driverCode: drivers.code,
        driverFullName: drivers.fullName,
        teamId: drivers.teamId,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(inArray(sessionResults.sessionId, allSessionIds))

    const raceSessionSet = new Set(raceSessionIds)
    const qualiSessionSet = new Set(qualiSessionIds)

    const teamDrivers = new Map<number, { teamName: string; teamColor: string; driverIds: Set<number> }>()
    const driverInfo = new Map<number, { code: string; fullName: string }>()

    for (const r of results) {
      driverInfo.set(r.driverId, { code: r.driverCode, fullName: r.driverFullName })
      if (!teamDrivers.has(r.teamId)) {
        teamDrivers.set(r.teamId, { teamName: r.teamName, teamColor: r.teamColor, driverIds: new Set() })
      }
      teamDrivers.get(r.teamId)!.driverIds.add(r.driverId)
    }

    const h2hTeams: TeammateH2HTeam[] = []

    for (const [, team] of teamDrivers) {
      const ids = Array.from(team.driverIds)
      if (ids.length < 2) continue

      const d1 = ids[0]
      const d2 = ids[1]
      const qualiBattle: [number, number] = [0, 0]
      const raceBattle: [number, number] = [0, 0]
      let qualiGapSum = 0
      let qualiGapCount = 0
      let d1Points = 0
      let d2Points = 0

      const bySession = new Map<number, Map<number, typeof results[number]>>()
      for (const r of results) {
        if (r.teamId !== ids[0] && !team.driverIds.has(r.driverId)) continue
        if (!team.driverIds.has(r.driverId)) continue
        if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, new Map())
        bySession.get(r.sessionId)!.set(r.driverId, r)
      }

      for (const [sessionId, driverResults] of bySession) {
        const r1 = driverResults.get(d1)
        const r2 = driverResults.get(d2)
        if (!r1 || !r2) continue

        if (raceSessionSet.has(sessionId)) {
          if (r1.position < r2.position) raceBattle[0]++
          else if (r2.position < r1.position) raceBattle[1]++
          d1Points += r1.points
          d2Points += r2.points
        }

        if (qualiSessionSet.has(sessionId)) {
          if (r1.position < r2.position) qualiBattle[0]++
          else if (r2.position < r1.position) qualiBattle[1]++

          const t1 = parseLapTimeToMs(r1.q3Time) ?? parseLapTimeToMs(r1.q2Time) ?? parseLapTimeToMs(r1.q1Time)
          const t2 = parseLapTimeToMs(r2.q3Time) ?? parseLapTimeToMs(r2.q2Time) ?? parseLapTimeToMs(r2.q1Time)
          if (t1 !== null && t2 !== null) {
            qualiGapSum += t1 - t2
            qualiGapCount++
          }
        }
      }

      h2hTeams.push({
        teamName: team.teamName,
        teamColor: team.teamColor,
        driver1: driverInfo.get(d1)!,
        driver2: driverInfo.get(d2)!,
        qualiBattle,
        raceBattle,
        avgQualiGapMs: qualiGapCount > 0 ? Math.round(qualiGapSum / qualiGapCount) : null,
        pointsDelta: d1Points - d2Points,
      })
    }

    return NextResponse.json({ season, teams: h2hTeams } satisfies TeammateH2HResponse)
  } catch {
    return NextResponse.json({ error: "Failed to fetch teammate H2H data" }, { status: 500 })
  }
}

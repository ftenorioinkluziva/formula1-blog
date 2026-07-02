import { NextResponse } from "next/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, raceSessions, raceWeekends, sessionResults, teams } from "@/lib/db/schema"
import type { ChampionshipResponse, ChampionshipProgression } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? new Date().getFullYear().toString(), 10)
    const type = searchParams.get("type") === "constructors" ? "constructors" : "drivers"

    const db = getDb()!

    const weekends = await db
      .select({ id: raceWeekends.id, round: raceWeekends.round, grandPrixName: raceWeekends.grandPrixName })
      .from(raceWeekends)
      .where(eq(raceWeekends.season, season))
      .orderBy(asc(raceWeekends.round))

    if (!weekends.length) {
      return NextResponse.json({ error: "No weekends found for season" }, { status: 404 })
    }

    const weekendIds = weekends.map((w) => w.id)

    const sessions = await db
      .select({ id: raceSessions.id, weekendId: raceSessions.weekendId, sessionCode: raceSessions.sessionCode })
      .from(raceSessions)
      .where(and(inArray(raceSessions.weekendId, weekendIds), inArray(raceSessions.sessionCode, ["R", "SPR"])))

    if (!sessions.length) {
      return NextResponse.json({ season, type, rounds: [], progressions: [] })
    }

    const sessionIds = sessions.map((s) => s.id)
    const sessionToWeekend = new Map(sessions.map((s) => [s.id, s.weekendId]))
    const weekendToRound = new Map(weekends.map((w) => [w.id, w.round]))

    const results = await db
      .select({
        sessionId: sessionResults.sessionId,
        driverId: sessionResults.driverId,
        points: sessionResults.points,
        driverCode: drivers.code,
        driverFullName: drivers.fullName,
        teamId: drivers.teamId,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(inArray(sessionResults.sessionId, sessionIds))

    const roundsWithResults = new Set<number>()
    for (const r of results) {
      const weekendId = sessionToWeekend.get(r.sessionId)
      if (weekendId) {
        const round = weekendToRound.get(weekendId)
        if (round) roundsWithResults.add(round)
      }
    }

    const activeRounds = weekends.filter((w) => roundsWithResults.has(w.round))

    if (type === "drivers") {
      const driverPoints = new Map<number, { code: string; name: string; color: string; roundPoints: Map<number, number> }>()

      for (const r of results) {
        const weekendId = sessionToWeekend.get(r.sessionId)!
        const round = weekendToRound.get(weekendId)!

        if (!driverPoints.has(r.driverId)) {
          driverPoints.set(r.driverId, { code: r.driverCode, name: r.driverFullName, color: r.teamColor, roundPoints: new Map() })
        }
        const entry = driverPoints.get(r.driverId)!
        entry.roundPoints.set(round, (entry.roundPoints.get(round) ?? 0) + r.points)
      }

      const progressions: ChampionshipProgression[] = Array.from(driverPoints.entries()).map(([id, data]) => {
        let cumulative = 0
        return {
          id,
          code: data.code,
          name: data.name,
          color: data.color,
          pointsByRound: activeRounds.map((w) => {
            const pts = data.roundPoints.get(w.round) ?? 0
            cumulative += pts
            return { round: w.round, grandPrixName: w.grandPrixName, points: pts, cumulative }
          }),
        }
      })

      progressions.sort((a, b) => {
        const aTotal = a.pointsByRound[a.pointsByRound.length - 1]?.cumulative ?? 0
        const bTotal = b.pointsByRound[b.pointsByRound.length - 1]?.cumulative ?? 0
        return bTotal - aTotal
      })

      return NextResponse.json({
        season,
        type,
        rounds: activeRounds.map((w) => ({ round: w.round, grandPrixName: w.grandPrixName })),
        progressions,
      } satisfies ChampionshipResponse)
    }

    const teamPoints = new Map<number, { name: string; color: string; roundPoints: Map<number, number> }>()

    for (const r of results) {
      const weekendId = sessionToWeekend.get(r.sessionId)!
      const round = weekendToRound.get(weekendId)!

      if (!teamPoints.has(r.teamId)) {
        teamPoints.set(r.teamId, { name: r.teamName, color: r.teamColor, roundPoints: new Map() })
      }
      const entry = teamPoints.get(r.teamId)!
      entry.roundPoints.set(round, (entry.roundPoints.get(round) ?? 0) + r.points)
    }

    const progressions: ChampionshipProgression[] = Array.from(teamPoints.entries()).map(([id, data]) => {
      let cumulative = 0
      return {
        id,
        code: data.name,
        name: data.name,
        color: data.color,
        pointsByRound: activeRounds.map((w) => {
          const pts = data.roundPoints.get(w.round) ?? 0
          cumulative += pts
          return { round: w.round, grandPrixName: w.grandPrixName, points: pts, cumulative }
        }),
      }
    })

    progressions.sort((a, b) => {
      const aTotal = a.pointsByRound[a.pointsByRound.length - 1]?.cumulative ?? 0
      const bTotal = b.pointsByRound[b.pointsByRound.length - 1]?.cumulative ?? 0
      return bTotal - aTotal
    })

    return NextResponse.json({
      season,
      type,
      rounds: activeRounds.map((w) => ({ round: w.round, grandPrixName: w.grandPrixName })),
      progressions,
    } satisfies ChampionshipResponse)
  } catch {
    return NextResponse.json({ error: "Failed to fetch championship data" }, { status: 500 })
  }
}

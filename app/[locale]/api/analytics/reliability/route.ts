import { NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, raceSessions, raceWeekends, sessionResults, teams } from "@/lib/db/schema"
import { isDnf } from "@/lib/analytics/lap-time-parser"
import type { ReliabilityResponse, ReliabilityEntry } from "@/lib/analytics/types"

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

    const raceSessionRows = await db
      .select({ id: raceSessions.id })
      .from(raceSessions)
      .where(and(inArray(raceSessions.weekendId, weekends.map((w) => w.id)), eq(raceSessions.sessionCode, "R")))

    if (!raceSessionRows.length) {
      return NextResponse.json({ season, drivers: [] } satisfies ReliabilityResponse)
    }

    const results = await db
      .select({
        driverId: sessionResults.driverId,
        status: sessionResults.status,
        driverCode: drivers.code,
        fullName: drivers.fullName,
        teamColor: teams.color,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(inArray(sessionResults.sessionId, raceSessionRows.map((r) => r.id)))

    const driverDnfs = new Map<number, { code: string; fullName: string; teamColor: string; dnfsByType: Map<string, number> }>()

    for (const r of results) {
      if (!isDnf(r.status)) continue

      if (!driverDnfs.has(r.driverId)) {
        driverDnfs.set(r.driverId, {
          code: r.driverCode,
          fullName: r.fullName,
          teamColor: r.teamColor,
          dnfsByType: new Map(),
        })
      }

      const entry = driverDnfs.get(r.driverId)!
      const type = r.status.toLowerCase()
      entry.dnfsByType.set(type, (entry.dnfsByType.get(type) ?? 0) + 1)
    }

    const driverEntries: ReliabilityEntry[] = Array.from(driverDnfs.values())
      .map((d) => ({
        driverCode: d.code,
        fullName: d.fullName,
        teamColor: d.teamColor,
        dnfCount: Array.from(d.dnfsByType.values()).reduce((sum, n) => sum + n, 0),
        dnfsByType: Object.fromEntries(d.dnfsByType),
      }))
      .sort((a, b) => b.dnfCount - a.dnfCount)

    return NextResponse.json({ season, drivers: driverEntries } satisfies ReliabilityResponse)
  } catch {
    return NextResponse.json({ error: "Failed to fetch reliability data" }, { status: 500 })
  }
}

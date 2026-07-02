import { NextResponse } from "next/server"
import { and, asc, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceWeekends, raceSessions, sessionResults } from "@/lib/db/schema"
import type { RaceWeekendListResponse } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? new Date().getFullYear().toString(), 10)

    const db = getDb()
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const weekends = await db
      .select({
        round: raceWeekends.round,
        grandPrixName: raceWeekends.grandPrixName,
        country: raceWeekends.country,
        hasResults: sql<boolean>`EXISTS (
          SELECT 1 FROM race_sessions rs
          JOIN session_results sr ON sr.session_id = rs.id
          WHERE rs.weekend_id = "race_weekends"."id"
          AND rs.session_code = 'R'
        )`,
      })
      .from(raceWeekends)
      .where(eq(raceWeekends.season, season))
      .orderBy(asc(raceWeekends.round))

    const response: RaceWeekendListResponse = {
      season,
      weekends: weekends.map((w) => ({
        round: w.round,
        grandPrixName: w.grandPrixName,
        country: w.country,
        hasResults: w.hasResults,
      })),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[race-weekends]", err)
    return NextResponse.json({ error: "Failed to fetch race weekends" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getDb } from "@/lib/db/client"
import { lapSummaries, raceSessions, raceWeekends } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const db = getDb()
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 })

  const rows = await db
    .select({
      sessionId: raceSessions.id,
      sessionType: raceSessions.sessionType,
      sessionCode: raceSessions.sessionCode,
      startTimeUtc: raceSessions.startTimeUtc,
      grandPrixName: raceWeekends.grandPrixName,
      season: raceWeekends.season,
      round: raceWeekends.round,
      country: raceWeekends.country,
      lapCount: sql<number>`cast(count(${lapSummaries.id}) as int)`,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .innerJoin(lapSummaries, eq(lapSummaries.sessionId, raceSessions.id))
    .groupBy(raceSessions.id, raceWeekends.id)
    .having(sql`count(${lapSummaries.id}) > 0`)
    .orderBy(desc(raceWeekends.season), desc(raceWeekends.round), desc(raceSessions.startTimeUtc))

  return NextResponse.json({ sessions: rows })
}

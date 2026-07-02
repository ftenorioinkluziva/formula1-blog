import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"

export async function resolveSessionId(
  season: number,
  round: number,
  sessionCode: string,
): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db
    .select({ sessionId: raceSessions.id })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        eq(raceWeekends.season, season),
        eq(raceWeekends.round, round),
        eq(raceSessions.sessionCode, sessionCode),
      ),
    )
    .limit(1)

  return rows[0]?.sessionId ?? null
}

export async function resolveWeekendId(
  season: number,
  round: number,
): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db
    .select({ id: raceWeekends.id })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  return rows[0]?.id ?? null
}

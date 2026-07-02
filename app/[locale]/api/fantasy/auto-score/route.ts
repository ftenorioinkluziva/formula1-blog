import { NextResponse } from "next/server"
import { and, eq, lt, gte, sql, isNull, not, exists } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { fantasySeasons, raceWeekends, raceSessions, fantasyRoundScores, fantasyRoundEntries } from "@/lib/db/schema"
import { scoreFantasyRound } from "@/lib/db/fantasy-scoring"
import { evolveFantasyPrices } from "@/lib/db/fantasy-pricing"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface RoundResult {
  round: number
  weekend: string
  status: "scored" | "skipped" | "error"
  detail?: string
}

export async function GET(): Promise<Response> {
  const db = getDb()

  if (!db) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 })
  }

  const activeSeason = await db
    .select({ id: fantasySeasons.id, season: fantasySeasons.season })
    .from(fantasySeasons)
    .where(eq(fantasySeasons.isActive, true))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!activeSeason) {
    return NextResponse.json({ error: "No active fantasy season" }, { status: 404 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const finishedWeekends = await db
    .selectDistinct({ weekendId: raceSessions.weekendId })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        eq(raceWeekends.season, activeSeason.season),
        eq(raceSessions.sessionType, "Race"),
        lt(raceSessions.endTimeUtc, now),
        gte(raceSessions.endTimeUtc, windowStart),
      ),
    )

  if (!finishedWeekends.length) {
    return NextResponse.json({ message: "No finished races in the last 7 days", rounds: [] })
  }

  const weekendIds = finishedWeekends.map((r) => r.weekendId)

  const alreadyScoredWeekendIds = await db
    .selectDistinct({ weekendId: fantasyRoundScores.weekendId })
    .from(fantasyRoundScores)
    .where(and(eq(fantasyRoundScores.seasonId, activeSeason.id), eq(fantasyRoundScores.isOfficial, true)))
    .then((rows) => new Set(rows.map((r) => r.weekendId)))

  const pendingWeekendIds = weekendIds.filter((id) => !alreadyScoredWeekendIds.has(id))

  if (!pendingWeekendIds.length) {
    return NextResponse.json({ message: "All recent rounds already have official scores", rounds: [] })
  }

  const pendingWeekends = await db
    .select({ id: raceWeekends.id, round: raceWeekends.round, grandPrixName: raceWeekends.grandPrixName })
    .from(raceWeekends)
    .where(
      and(
        eq(raceWeekends.season, activeSeason.season),
        sql`${raceWeekends.id} = ANY(${sql.raw(`ARRAY[${pendingWeekendIds.join(",")}]`)})`,
      ),
    )
    .orderBy(raceWeekends.round)

  const results: RoundResult[] = []

  for (const weekend of pendingWeekends) {
    try {
      await scoreFantasyRound(activeSeason.season, weekend.round)

      const hasNextRound = pendingWeekends.find((w) => w.round === weekend.round + 1)

      if (!hasNextRound) {
        await evolveFantasyPrices(activeSeason.season, weekend.round, weekend.round + 1)
      }

      results.push({ round: weekend.round, weekend: weekend.grandPrixName, status: "scored" })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ round: weekend.round, weekend: weekend.grandPrixName, status: "error", detail: message })
    }
  }

  return NextResponse.json({ season: activeSeason.season, rounds: results })
}

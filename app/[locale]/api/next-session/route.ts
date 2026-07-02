import "server-only"

import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import { and, gt, ne, asc, eq, lte } from "drizzle-orm"

const PRE_SESSION_LEAD_MS = 60 * 60 * 1000 // 1 hour

export async function GET() {
  const db = getDb()
  if (!db) {
    return Response.json({ error: "Database unavailable" }, { status: 503 })
  }

  try {
    const now = new Date()
    const windowEnd = new Date(now.getTime() + PRE_SESSION_LEAD_MS)

    const [session] = await db
      .select({
        id: raceSessions.id,
        sessionType: raceSessions.sessionType,
        startTimeUtc: raceSessions.startTimeUtc,
        endTimeUtc: raceSessions.endTimeUtc,
        grandPrixName: raceWeekends.grandPrixName,
      })
      .from(raceSessions)
      .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
      .where(
        and(
          gt(raceSessions.endTimeUtc, now),
          lte(raceSessions.startTimeUtc, windowEnd),
          ne(raceSessions.status, "cancelled"),
        ),
      )
      .orderBy(asc(raceSessions.startTimeUtc))
      .limit(1)

    if (!session) {
      return Response.json(
        {
          hasUpcomingSession: false,
          nextSession: null,
          minutesUntil: null,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=300",
          },
        },
      )
    }

    const minutesUntil = Math.round((session.startTimeUtc.getTime() - now.getTime()) / 60_000)
    const isLive = minutesUntil <= 0

    return Response.json(
      {
        hasUpcomingSession: true,
        nextSession: {
          id: session.id,
          sessionType: session.sessionType,
          startTimeUtc: session.startTimeUtc,
          endTimeUtc: session.endTimeUtc,
          grandPrixName: session.grandPrixName,
        },
        minutesUntil,
        isLive,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      },
    )
  } catch (error) {
    console.error("[next-session] Error:", error)
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

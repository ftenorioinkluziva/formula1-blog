import { and, asc, eq, gt, gte, lte, ne, or } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"

export type BannerSessionKind = "live" | "next"

export interface BannerSessionItem {
  name: string
  circuit: string
  country: string
  type: string
  part: number | null
  startTimeUtc: string
}

export interface BannerSessionPayload {
  kind: BannerSessionKind
  session: BannerSessionItem
}

function mapSession(session: typeof raceSessions.$inferSelect, weekend: typeof raceWeekends.$inferSelect): BannerSessionItem {
  return {
    name: weekend.grandPrixName,
    circuit: weekend.circuit,
    country: weekend.country,
    type: session.sessionType,
    part: session.part,
    startTimeUtc: session.startTimeUtc.toISOString(),
  }
}

export async function getSessionBannerPayload(): Promise<BannerSessionPayload | null> {
  const db = getDb()

  if (!db) {
    return null
  }

  const now = new Date()

  const [liveSession] = await db
    .select({
      session: raceSessions,
      weekend: raceWeekends,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      or(
        eqLiveStatus(),
        and(
          lte(raceSessions.startTimeUtc, now),
          gte(raceSessions.endTimeUtc, now),
          ne(raceSessions.status, "cancelled"),
        ),
      ),
    )
    .orderBy(asc(raceSessions.startTimeUtc))
    .limit(1)

  if (liveSession) {
    return {
      kind: "live",
      session: mapSession(liveSession.session, liveSession.weekend),
    }
  }

  const [nextSession] = await db
    .select({
      session: raceSessions,
      weekend: raceWeekends,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        gt(raceSessions.startTimeUtc, now),
        ne(raceSessions.status, "cancelled"),
      ),
    )
    .orderBy(asc(raceSessions.startTimeUtc))
    .limit(1)

  if (!nextSession) {
    return null
  }

  return {
    kind: "next",
    session: mapSession(nextSession.session, nextSession.weekend),
  }
}

function eqLiveStatus() {
  return or(eqStatus("live"), eqStatus("started"), eqStatus("in_progress"))
}

function eqStatus(value: string) {
  return and(
    ne(raceSessions.status, "cancelled"),
    ne(raceSessions.status, "completed"),
    ne(raceSessions.status, "finished"),
    eq(raceSessions.status, value),
  )
}

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, raceSessions, raceWeekends, sessionResults } from "@/lib/db/schema"

export interface RaceWeekendSessionItem {
  session: string
  day: string
  time: string
  startTimeUtc: string
}

export interface RaceWeekendCalendarItem {
  round: number
  name: string
  circuit: string
  location: string
  date: string
  time: string
  raceStartUtc: string
  winner: string | null
  sessions: RaceWeekendSessionItem[]
}

function formatDateLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).formatToParts(date)

  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""

  return `${month} ${day}`
}

function formatTimeLabel(date: Date): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)

  return `${time} GMT`
}

function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date)
}

async function resolveSeason(): Promise<number | null> {
  const db = getDb()

  if (!db) {
    return null
  }

  const [latest] = await db
    .select({ season: raceWeekends.season })
    .from(raceWeekends)
    .orderBy(desc(raceWeekends.season))
    .limit(1)

  return latest?.season ?? null
}

export async function getRaceWeekendsCalendar(season?: number): Promise<RaceWeekendCalendarItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const targetSeason = season ?? (await resolveSeason())

  if (!targetSeason) {
    return []
  }

  const weekends = await db
    .select()
    .from(raceWeekends)
    .where(eq(raceWeekends.season, targetSeason))
    .orderBy(asc(raceWeekends.round))

  const weekendIds = weekends.map((weekend) => weekend.id)

  if (weekendIds.length === 0) {
    return []
  }

  const weekendById = new Map<number, (typeof weekends)[number]>()

  for (const weekend of weekends) {
    weekendById.set(weekend.id, weekend)
  }

  const sessions = await db
    .select()
    .from(raceSessions)
    .where(and(inArray(raceSessions.weekendId, weekendIds), eq(raceSessions.sessionCode, "R")))
    .orderBy(asc(raceSessions.startTimeUtc))

  const allSessions = await db
    .select()
    .from(raceSessions)
    .where(inArray(raceSessions.weekendId, weekendIds))
    .orderBy(asc(raceSessions.startTimeUtc))

  const sessionsByWeekend = new Map<number, typeof allSessions>()

  for (const session of allSessions) {
    const list = sessionsByWeekend.get(session.weekendId) ?? []
    list.push(session)
    sessionsByWeekend.set(session.weekendId, list)
  }

  const raceSessionByRound = new Map<number, { date: Date; sessionId: number }>()

  for (const session of sessions) {
    const weekend = weekendById.get(session.weekendId)

    if (!weekend) {
      continue
    }

    raceSessionByRound.set(weekend.round, { date: session.startTimeUtc, sessionId: session.id })
  }

  // Fetch winners (P1) for all race sessions in one query
  const raceSessionIds = Array.from(raceSessionByRound.values()).map((s) => s.sessionId)

  const winnerBySessionId = new Map<number, string>()

  if (raceSessionIds.length > 0) {
    const winnerRows = await db
      .select({
        sessionId: sessionResults.sessionId,
        driverName: drivers.fullName,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .where(and(inArray(sessionResults.sessionId, raceSessionIds), eq(sessionResults.position, 1)))

    for (const row of winnerRows) {
      winnerBySessionId.set(row.sessionId, row.driverName)
    }
  }

  return weekends.map((weekend) => {
    const raceInfo = raceSessionByRound.get(weekend.round)
    const raceDate = raceInfo?.date ?? new Date(Date.UTC(targetSeason, 0, 1, 0, 0, 0, 0))
    const winner = raceInfo ? (winnerBySessionId.get(raceInfo.sessionId) ?? null) : null
    const weekendSessions = sessionsByWeekend.get(weekend.id) ?? []

    return {
      round: weekend.round,
      name: weekend.grandPrixName,
      circuit: weekend.circuit,
      location: weekend.location,
      date: formatDateLabel(raceDate),
      time: formatTimeLabel(raceDate),
      raceStartUtc: raceDate.toISOString(),
      winner,
      sessions: weekendSessions.map((session) => ({
        session: session.sessionType,
        day: formatWeekday(session.startTimeUtc),
        time: formatTimeLabel(session.startTimeUtc),
        startTimeUtc: session.startTimeUtc.toISOString(),
      })),
    }
  })
}

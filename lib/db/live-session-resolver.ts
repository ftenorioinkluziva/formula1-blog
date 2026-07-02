import { and, desc, eq, gte, lte } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"

function normalizeSessionType(rawState: F1LiveTimingRawState): string | null {
  const sessionInfo = (rawState.SessionInfo || {}) as Record<string, unknown>
  const type = typeof sessionInfo.Type === "string" ? sessionInfo.Type.trim() : ""
  const name = typeof sessionInfo.Name === "string" ? sessionInfo.Name.trim() : ""

  if (type.length > 0) {
    return type
  }

  if (name.length > 0) {
    return name
  }

  return null
}

export function parseDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function getSessionPath(rawState: F1LiveTimingRawState): string {
  const sessionInfo = (rawState.SessionInfo || {}) as Record<string, unknown>
  return typeof sessionInfo.Path === "string" ? sessionInfo.Path.trim() : ""
}

function parseSessionPath(rawState: F1LiveTimingRawState): {
  season: number | null
  sessionDate: Date | null
  sessionType: string | null
  meetingName: string | null
} {
  const path = getSessionPath(rawState)
  const match = path.match(/^(\d{4})\/(\d{4}-\d{2}-\d{2})_(.+?)\/(\d{4}-\d{2}-\d{2})_([^/]+)\/?$/)

  const season = match ? Number(match[1]) : null
  const sessionDate = match ? parseDateOrNull(`${match[4]}T12:00:00.000Z`) : null
  const sessionType = match ? match[5].replace(/_/g, " ").trim() : null
  const meetingName = match ? match[3].replace(/_/g, " ").trim() : null

  return {
    season: Number.isInteger(season) ? season : null,
    sessionDate,
    sessionType: sessionType || null,
    meetingName: meetingName || null,
  }
}

async function resolveSessionByPath(rawState: F1LiveTimingRawState): Promise<number | null> {
  const db = getDb()
  if (!db) {
    return null
  }

  const parsed = parseSessionPath(rawState)
  if (!parsed.sessionDate || !parsed.sessionType) {
    return null
  }

  const startWindow = new Date(parsed.sessionDate.getTime() - 24 * 60 * 60 * 1000)
  const endWindow = new Date(parsed.sessionDate.getTime() + 24 * 60 * 60 * 1000)

  const meetingName = parsed.meetingName?.replace(/ Grand Prix$/i, "") ?? null

  const rows = await db
    .select({
      id: raceSessions.id,
      grandPrixName: raceWeekends.grandPrixName,
      startTimeUtc: raceSessions.startTimeUtc,
    })
    .from(raceSessions)
    .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
    .where(
      and(
        parsed.season ? eq(raceWeekends.season, parsed.season) : undefined,
        eq(raceSessions.sessionType, parsed.sessionType),
        gte(raceSessions.startTimeUtc, startWindow),
        lte(raceSessions.startTimeUtc, endWindow),
      ),
    )
    .orderBy(desc(raceSessions.startTimeUtc))

  if (rows.length === 0) {
    return null
  }

  if (!meetingName) {
    return rows[0]?.id ?? null
  }

  const exact = rows.find((row) => row.grandPrixName.replace(/ Grand Prix$/i, "") === meetingName)
  return exact?.id ?? rows[0]?.id ?? null
}

export async function resolveLiveSessionId(rawState: F1LiveTimingRawState, capturedAt: Date): Promise<number | null> {
  const db = getDb()

  if (!db) {
    return null
  }

  const sessionType = normalizeSessionType(rawState)

  const whereClause = sessionType
    ? and(
      lte(raceSessions.startTimeUtc, capturedAt),
      gte(raceSessions.endTimeUtc, capturedAt),
      eq(raceSessions.sessionType, sessionType),
    )
    : and(
      lte(raceSessions.startTimeUtc, capturedAt),
      gte(raceSessions.endTimeUtc, capturedAt),
    )

  const [session] = await db
    .select({ id: raceSessions.id })
    .from(raceSessions)
    .where(whereClause)
    .orderBy(desc(raceSessions.startTimeUtc))
    .limit(1)

  if (session?.id) {
    return session.id
  }

  return await resolveSessionByPath(rawState)
}

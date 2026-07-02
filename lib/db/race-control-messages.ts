import { and, desc, eq, gte, lte } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceControlMessages, raceSessions, sessionStatusEvents } from "@/lib/db/schema"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"
import { normalizeEntries } from "@/lib/live-timing/formatters"
import { parseDateOrNull, parseInteger, resolveLiveSessionId } from "@/lib/db/live-session-resolver"

export interface RaceControlMessageItem {
  id: number
  messageType: string
  flag: string
  lap: number | null
  messageText: string
  racingNumber: string | null
  occurredAtUtc: string
}

export async function persistLiveTimingPhase1(rawState: F1LiveTimingRawState, capturedAtIso: string): Promise<void> {
  const db = getDb()

  if (!db) {
    return
  }

  const capturedAt = parseDateOrNull(capturedAtIso) ?? new Date()
  const sessionId = await resolveLiveSessionId(rawState, capturedAt)

  if (!sessionId) {
    return
  }

  const status = typeof rawState.SessionStatus?.Status === "string" ? rawState.SessionStatus.Status.trim() : ""
  const statusReason = typeof rawState.SessionStatus?.Message === "string"
    ? rawState.SessionStatus.Message.trim()
    : typeof rawState.SessionStatus?.Reason === "string"
      ? rawState.SessionStatus.Reason.trim()
      : null

  const statusOccurredAt = parseDateOrNull(rawState.ExtrapolatedClock?.Utc) ?? capturedAt

  if (status.length > 0) {
    await db
      .insert(sessionStatusEvents)
      .values({
        sessionId,
        status,
        statusReason: statusReason && statusReason.length > 0 ? statusReason : null,
        occurredAtUtc: statusOccurredAt,
      })
      .onConflictDoNothing()

    await db
      .update(raceSessions)
      .set({ status })
      .where(eq(raceSessions.id, sessionId))
  }

  const messages = normalizeEntries(rawState.RaceControlMessages?.Messages || {}) as Array<Record<string, unknown>>

  if (messages.length === 0) {
    return
  }

  const values = messages
    .map((message) => {
      const messageText = typeof message.Message === "string" ? message.Message.trim() : ""

      if (!messageText) {
        return null
      }

      const occurredAtUtc = parseDateOrNull(message.Utc) ?? statusOccurredAt
      const lap = parseInteger(message.Lap)
      const messageType = typeof message.Category === "string" ? message.Category.trim() : "Other"
      const flag = typeof message.Flag === "string" ? message.Flag.trim() : ""
      const racingNumber = typeof message.RacingNumber === "string" ? message.RacingNumber.trim() : ""

      return {
        sessionId,
        messageType: messageType || "Other",
        flag,
        lap: lap ?? -1,
        messageText,
        racingNumber,
        occurredAtUtc,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)

  if (values.length === 0) {
    return
  }

  await db
    .insert(raceControlMessages)
    .values(values)
    .onConflictDoNothing()
}

export async function getRaceControlMessages(
  sessionId: number,
  limit = 100,
): Promise<RaceControlMessageItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const normalizedLimit = Math.max(1, Math.min(limit, 500))

  const rows = await db
    .select()
    .from(raceControlMessages)
    .where(eq(raceControlMessages.sessionId, sessionId))
    .orderBy(desc(raceControlMessages.occurredAtUtc), desc(raceControlMessages.id))
    .limit(normalizedLimit)

  return rows
    .map((row) => ({
      id: row.id,
      messageType: row.messageType,
      flag: row.flag,
      lap: row.lap >= 0 ? row.lap : null,
      messageText: row.messageText,
      racingNumber: row.racingNumber.length > 0 ? row.racingNumber : null,
      occurredAtUtc: row.occurredAtUtc.toISOString(),
    }))
    .sort((left, right) => left.occurredAtUtc.localeCompare(right.occurredAtUtc))
}

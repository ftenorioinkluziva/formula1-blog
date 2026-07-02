import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { sessionStatusEvents } from "@/lib/db/schema"

export interface SessionStatusTimelineItem {
  id: number
  status: string
  reason: string | null
  occurredAtUtc: string
}

export async function getSessionStatusTimeline(
  sessionId: number,
): Promise<SessionStatusTimelineItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const rows = await db
    .select()
    .from(sessionStatusEvents)
    .where(eq(sessionStatusEvents.sessionId, sessionId))
    .orderBy(asc(sessionStatusEvents.occurredAtUtc), asc(sessionStatusEvents.id))

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    reason: row.statusReason,
    occurredAtUtc: row.occurredAtUtc.toISOString(),
  }))
}

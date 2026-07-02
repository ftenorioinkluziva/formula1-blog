import { getLapSummaries } from "@/lib/db/lap-summaries"
import { getRaceControlMessages } from "@/lib/db/race-control-messages"
import { getSessionStatusTimeline } from "@/lib/db/session-status-events"

const RECENT_STATUS_LIMIT = 6
const RECENT_RACE_CONTROL_LIMIT = 6

export interface SessionAnalyticsOverview {
  sessionId: number
  latestStatus: string | null
  statusEvents: number
  raceControlMessages: number
  completedLaps: number
  recentStatusTimeline: Array<{
    status: string
    reason: string | null
    occurredAtUtc: string
  }>
  recentRaceControlMessages: Array<{
    messageType: string
    occurredAtUtc: string
    messageText: string
  }>
  latestRaceControlMessage: {
    messageType: string
    occurredAtUtc: string
    messageText: string
  } | null
}

export async function getSessionAnalyticsOverview(sessionId: number): Promise<SessionAnalyticsOverview> {
  const [timeline, raceControl, laps] = await Promise.all([
    getSessionStatusTimeline(sessionId),
    getRaceControlMessages(sessionId, 500),
    getLapSummaries(sessionId, 2000),
  ])

  const latestStatus = timeline.length > 0 ? timeline[timeline.length - 1]?.status ?? null : null
  const latestRaceControl = raceControl.length > 0 ? raceControl[raceControl.length - 1] : null
  const recentStatusTimeline = timeline
    .slice(Math.max(0, timeline.length - RECENT_STATUS_LIMIT))
    .map((event) => ({
      status: event.status,
      reason: event.reason,
      occurredAtUtc: event.occurredAtUtc,
    }))

  const recentRaceControlMessages = raceControl
    .slice(Math.max(0, raceControl.length - RECENT_RACE_CONTROL_LIMIT))
    .map((message) => ({
      messageType: message.messageType,
      occurredAtUtc: message.occurredAtUtc,
      messageText: message.messageText,
    }))

  return {
    sessionId,
    latestStatus,
    statusEvents: timeline.length,
    raceControlMessages: raceControl.length,
    completedLaps: laps.length,
    recentStatusTimeline,
    recentRaceControlMessages,
    latestRaceControlMessage: latestRaceControl
      ? {
        messageType: latestRaceControl.messageType,
        occurredAtUtc: latestRaceControl.occurredAtUtc,
        messageText: latestRaceControl.messageText,
      }
      : null,
  }
}

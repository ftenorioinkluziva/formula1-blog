export interface SessionOverviewPayload {
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

export interface CurrentSessionAnalyticsApiPayload {
  sessionId: number | null
  overview: SessionOverviewPayload | null
  message?: string
  error?: string
}

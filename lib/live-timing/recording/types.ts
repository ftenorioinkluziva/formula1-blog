export interface RecordingMessage {
  ts: number
  topic: string
  data: unknown
}

export interface RecordingHeader {
  type: '__header__'
  sessionKey: string
  startedAt: string
  circuit?: string
  sessionType?: string
}

export interface RecordingSnapshot {
  type: '__snapshot__'
  ts: number
  state: Record<string, unknown>
}

export interface RecordingMetadata {
  sessionKey: string
  startedAt: string
  circuit: string
  sessionType: string
  messageCount: number
  durationMs: number
  fileSize: number
  fileName: string
}

export interface TimelineEvent {
  ts: number
  type: 'flag' | 'session-status' | 'race-control'
  label: string
  color: string
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10

export interface ReplayControls {
  speed: PlaybackSpeed
  setSpeed: (speed: PlaybackSpeed) => void
  isPaused: boolean
  togglePause: () => void
  seek: (timestampMs: number) => void
  currentTs: number
  startTs: number
  endTs: number
  events: TimelineEvent[]
  progress: number
}

import type { F1LiveTimingRawState } from '@/lib/live-timing/types'
import { applyDelta } from '@/lib/live-timing/utils/deep-merge'
import { TOPIC_TO_RAW_STATE_KEY } from '@/lib/live-timing/signalr/topics'
import type { RecordingMessage, TimelineEvent, PlaybackSpeed } from './types'

export type StateUpdateCallback = (state: F1LiveTimingRawState, currentTs: number) => void

interface Snapshot {
  ts: number
  state: Record<string, unknown>
}

export class ReplayPlayer {
  private messages: RecordingMessage[] = []
  private snapshots: Snapshot[] = []
  private state: Record<string, unknown> = {}
  private currentIndex = 0
  private startTs = 0
  private endTs = 0
  private currentTs = 0
  private speed: PlaybackSpeed = 1
  private paused = true
  private rafId: number | null = null
  private lastFrameTime = 0
  private onUpdate: StateUpdateCallback | null = null
  private _events: TimelineEvent[] = []

  load(rawMessages: RecordingMessage[]): void {
    this.messages = []
    this.snapshots = []

    for (const msg of rawMessages) {
      if (msg.topic === '__snapshot__') {
        this.snapshots.push({ ts: msg.ts, state: msg.data as Record<string, unknown> })
      } else {
        this.messages.push(msg)
      }
    }

    if (this.messages.length > 0) {
      this.startTs = this.messages[0].ts
      this.endTs = this.messages[this.messages.length - 1].ts
    }

    this._events = this.extractEvents()
    this.seekTo(this.startTs)
  }

  private extractEvents(): TimelineEvent[] {
    const events: TimelineEvent[] = []

    for (const msg of this.messages) {
      if (msg.topic === 'TrackStatus') {
        const d = msg.data as Record<string, unknown>
        const status = d?.Status as string | undefined
        const message = d?.Message as string | undefined
        if (status) {
          const color = status === '1' ? '#22c55e'
            : ['2', '4', '6', '7'].includes(status) ? '#eab308'
            : status === '5' ? '#ef4444' : '#3b82f6'
          events.push({ ts: msg.ts, type: 'flag', label: message ?? `Flag ${status}`, color })
        }
      }

      if (msg.topic === 'SessionStatus') {
        const status = (msg.data as Record<string, unknown>)?.Status as string | undefined
        if (status) {
          events.push({ ts: msg.ts, type: 'session-status', label: status, color: '#a855f7' })
        }
      }
    }

    return events
  }

  setOnUpdate(cb: StateUpdateCallback): void {
    this.onUpdate = cb
  }

  seekTo(targetTs: number): void {
    const clamped = Math.max(this.startTs, Math.min(targetTs, this.endTs))

    let bestSnapshot: Snapshot | null = null
    for (const snap of this.snapshots) {
      if (snap.ts <= clamped) bestSnapshot = snap
      else break
    }

    if (bestSnapshot) {
      this.state = { ...bestSnapshot.state }
      this.currentIndex = this.messages.findIndex((m) => m.ts > bestSnapshot!.ts)
      if (this.currentIndex === -1) this.currentIndex = this.messages.length
    } else {
      this.state = {}
      this.currentIndex = 0
    }

    while (this.currentIndex < this.messages.length && this.messages[this.currentIndex].ts <= clamped) {
      const msg = this.messages[this.currentIndex]
      const stateKey = TOPIC_TO_RAW_STATE_KEY[msg.topic] ?? msg.topic
      this.state = applyDelta(this.state, stateKey, msg.data)
      this.currentIndex++
    }

    this.currentTs = clamped
    this.onUpdate?.(this.state as F1LiveTimingRawState, this.currentTs)
  }

  play(): void {
    if (!this.paused) return
    this.paused = false
    this.lastFrameTime = performance.now()
    this.tick()
  }

  pause(): void {
    this.paused = true
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  togglePause(): void {
    if (this.paused) this.play()
    else this.pause()
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed
  }

  getState(): {
    currentTs: number
    startTs: number
    endTs: number
    speed: PlaybackSpeed
    isPaused: boolean
    progress: number
    events: TimelineEvent[]
  } {
    const range = this.endTs - this.startTs
    return {
      currentTs: this.currentTs,
      startTs: this.startTs,
      endTs: this.endTs,
      speed: this.speed,
      isPaused: this.paused,
      progress: range > 0 ? (this.currentTs - this.startTs) / range : 0,
      events: this._events,
    }
  }

  destroy(): void {
    this.pause()
    this.messages = []
    this.snapshots = []
    this.state = {}
    this.onUpdate = null
  }

  private tick = (): void => {
    if (this.paused) return

    const now = performance.now()
    const elapsed = now - this.lastFrameTime
    this.lastFrameTime = now

    const simElapsed = elapsed * this.speed
    const targetTs = this.currentTs + simElapsed

    let updated = false
    while (this.currentIndex < this.messages.length && this.messages[this.currentIndex].ts <= targetTs) {
      const msg = this.messages[this.currentIndex]
      const stateKey = TOPIC_TO_RAW_STATE_KEY[msg.topic] ?? msg.topic
      this.state = applyDelta(this.state, stateKey, msg.data)
      this.currentIndex++
      updated = true
    }

    this.currentTs = Math.min(targetTs, this.endTs)

    if (updated) {
      this.onUpdate?.(this.state as F1LiveTimingRawState, this.currentTs)
    }

    if (this.currentTs >= this.endTs) {
      this.paused = true
      this.onUpdate?.(this.state as F1LiveTimingRawState, this.currentTs)
      return
    }

    this.rafId = requestAnimationFrame(this.tick)
  }
}

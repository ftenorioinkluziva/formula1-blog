import { readFileSync, readdirSync, statSync, unlinkSync, existsSync, createReadStream } from 'fs'
import { join } from 'path'
import type { Readable } from 'stream'
import type { RecordingHeader, RecordingMetadata, RecordingMessage, TimelineEvent } from './types'

const RECORDINGS_DIR = join(process.cwd(), 'data', 'recordings')

function parseHeader(firstLine: string): RecordingHeader | null {
  try {
    const parsed = JSON.parse(firstLine)
    if (parsed.type === '__header__') return parsed as RecordingHeader
    return null
  } catch {
    return null
  }
}

function countMessages(content: string): { count: number; firstTs: number; lastTs: number } {
  const lines = content.split('\n').filter(Boolean)
  let count = 0
  let firstTs = 0
  let lastTs = 0

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.type === '__header__' || parsed.type === '__snapshot__') continue
      count++
      const ts = parsed.ts as number
      if (ts) {
        if (!firstTs) firstTs = ts
        lastTs = ts
      }
    } catch {
      continue
    }
  }

  return { count, firstTs, lastTs }
}

export function listRecordings(): RecordingMetadata[] {
  if (!existsSync(RECORDINGS_DIR)) return []

  const files = readdirSync(RECORDINGS_DIR).filter((f) => f.endsWith('.ndjson'))
  const results: RecordingMetadata[] = []

  for (const fileName of files) {
    const filePath = join(RECORDINGS_DIR, fileName)
    try {
      const content = readFileSync(filePath, 'utf-8')
      const firstLine = content.split('\n')[0]
      const header = parseHeader(firstLine ?? '')
      const stats = statSync(filePath)
      const { count, firstTs, lastTs } = countMessages(content)

      results.push({
        sessionKey: header?.sessionKey ?? fileName.replace('.ndjson', ''),
        startedAt: header?.startedAt ?? stats.birthtime.toISOString(),
        circuit: header?.circuit ?? '',
        sessionType: header?.sessionType ?? '',
        messageCount: count,
        durationMs: lastTs && firstTs ? lastTs - firstTs : 0,
        fileSize: stats.size,
        fileName,
      })
    } catch {
      continue
    }
  }

  return results.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function getRecording(sessionKey: string): string | null {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = join(RECORDINGS_DIR, `${safeKey}.ndjson`)
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, 'utf-8')
}

export function getRecordingStream(sessionKey: string): Readable | null {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = join(RECORDINGS_DIR, `${safeKey}.ndjson`)
  if (!existsSync(filePath)) return null
  return createReadStream(filePath, { encoding: 'utf-8' })
}

export function deleteRecording(sessionKey: string): boolean {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = join(RECORDINGS_DIR, `${safeKey}.ndjson`)
  if (!existsSync(filePath)) return false
  unlinkSync(filePath)
  return true
}

export function extractTimelineEvents(sessionKey: string): TimelineEvent[] {
  const content = getRecording(sessionKey)
  if (!content) return []

  const events: TimelineEvent[] = []
  const lines = content.split('\n').filter(Boolean)

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as RecordingMessage & { type?: string }
      if (parsed.type === '__header__' || parsed.type === '__snapshot__') continue

      if (parsed.topic === 'TrackStatus') {
        const status = (parsed.data as Record<string, unknown>)?.Status as string | undefined
        const message = (parsed.data as Record<string, unknown>)?.Message as string | undefined
        if (status) {
          const color = status === '1' ? '#22c55e'
            : status === '2' || status === '4' || status === '6' || status === '7' ? '#eab308'
            : status === '5' ? '#ef4444'
            : '#3b82f6'
          events.push({ ts: parsed.ts, type: 'flag', label: message ?? `Flag ${status}`, color })
        }
      }

      if (parsed.topic === 'SessionStatus') {
        const status = (parsed.data as Record<string, unknown>)?.Status as string | undefined
        if (status) {
          events.push({ ts: parsed.ts, type: 'session-status', label: status, color: '#a855f7' })
        }
      }

      if (parsed.topic === 'RaceControlMessages') {
        const messages = (parsed.data as Record<string, unknown>)?.Messages as Record<string, Record<string, unknown>> | undefined
        if (messages) {
          for (const msg of Object.values(messages)) {
            const text = msg?.Message as string | undefined
            const category = msg?.Category as string | undefined
            if (text && (category === 'Flag' || category === 'SafetyCar')) {
              events.push({ ts: parsed.ts, type: 'race-control', label: text, color: '#f97316' })
            }
          }
        }
      }
    } catch {
      continue
    }
  }

  return events
}

export function parseRecordingMessages(content: string): RecordingMessage[] {
  const lines = content.split('\n').filter(Boolean)
  const messages: RecordingMessage[] = []

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.type === '__header__') continue
      if (parsed.type === '__snapshot__') {
        messages.push({ ts: parsed.ts, topic: '__snapshot__', data: parsed.state })
        continue
      }
      messages.push({ ts: parsed.ts, topic: parsed.topic, data: parsed.data })
    } catch {
      continue
    }
  }

  return messages
}

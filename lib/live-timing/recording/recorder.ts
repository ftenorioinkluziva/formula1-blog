import { onFeed, getSessionKey } from '@/lib/live-timing/signalr/client'
import { applyDelta } from '@/lib/live-timing/utils/deep-merge'
import { TOPIC_TO_RAW_STATE_KEY } from '@/lib/live-timing/signalr/topics'
import type { RecordingHeader, RecordingMessage } from './types'

const SNAPSHOT_INTERVAL_MS = 60_000
const FLUSH_INTERVAL_MS = 5_000
const FLUSH_BATCH_SIZE = 100

interface NodeModules {
  appendFileSync: (path: string, data: string) => void
  existsSync: (path: string) => boolean
  mkdirSync: (path: string, options: { recursive: boolean }) => void
  writeFileSync: (path: string, data: string) => void
  join: (...paths: string[]) => string
}

interface RecorderState {
  active: boolean
  filePath: string | null
  sessionKey: string | null
  startedAt: number
  messageCount: number
  buffer: string[]
  unsubscribeFeed: (() => void) | null
  flushTimer: ReturnType<typeof setInterval> | null
  lastSnapshotTs: number
  accumulatedState: Record<string, unknown>
}

const recorder: RecorderState = {
  active: false,
  filePath: null,
  sessionKey: null,
  startedAt: 0,
  messageCount: 0,
  buffer: [],
  unsubscribeFeed: null,
  flushTimer: null,
  lastSnapshotTs: 0,
  accumulatedState: {},
}

let nodeModules: NodeModules | null = null
let nodeModulesPromise: Promise<NodeModules> | null = null

const importModule = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>

async function ensureNodeModules(): Promise<NodeModules> {
  const isEdgeRuntime = typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== 'undefined'
  if (isEdgeRuntime) {
    throw new Error('Recording is not available in the Edge runtime')
  }

  if (nodeModules) {
    return nodeModules
  }

  if (nodeModulesPromise) {
    return nodeModulesPromise
  }

  nodeModulesPromise = Promise.all([
    importModule('node:fs'),
    importModule('node:path'),
  ]).then(([fs, path]) => {
    nodeModules = {
      appendFileSync: (fs as { appendFileSync: NodeModules['appendFileSync'] }).appendFileSync,
      existsSync: (fs as { existsSync: NodeModules['existsSync'] }).existsSync,
      mkdirSync: (fs as { mkdirSync: NodeModules['mkdirSync'] }).mkdirSync,
      writeFileSync: (fs as { writeFileSync: NodeModules['writeFileSync'] }).writeFileSync,
      join: (path as { join: NodeModules['join'] }).join,
    }

    return nodeModules
  })

  return nodeModulesPromise
}

function getNodeModules(): NodeModules {
  if (!nodeModules) {
    throw new Error('Node modules not initialized')
  }

  return nodeModules
}

function getRecordingsDir(): string {
  const { join } = getNodeModules()
  const cwd = Function('return process.cwd()')() as string
  return join(cwd, 'data', 'recordings')
}

function ensureDir(): void {
  const { existsSync, mkdirSync } = getNodeModules()
  const recordingsDir = getRecordingsDir()

  if (!existsSync(recordingsDir)) {
    mkdirSync(recordingsDir, { recursive: true })
  }
}

function flush(): void {
  if (recorder.buffer.length === 0 || !recorder.filePath) return
  const { appendFileSync } = getNodeModules()
  appendFileSync(recorder.filePath, recorder.buffer.join('\n') + '\n')
  recorder.buffer = []
}

function writeSnapshot(ts: number): void {
  if (!recorder.filePath) return
  const snapshotLine = JSON.stringify({ type: '__snapshot__', ts, state: recorder.accumulatedState })
  recorder.buffer.push(snapshotLine)
  recorder.lastSnapshotTs = ts
}

function handleMessage(topic: string, data: unknown, _timestamp: Date): void {
  if (!recorder.active) return
  if (topic === 'Heartbeat') return

  const ts = Date.now()
  const msg: RecordingMessage = { ts, topic, data }
  recorder.buffer.push(JSON.stringify(msg))
  recorder.messageCount++

  const stateKey = TOPIC_TO_RAW_STATE_KEY[topic] ?? topic
  recorder.accumulatedState = applyDelta(recorder.accumulatedState, stateKey, data)

  if (ts - recorder.lastSnapshotTs >= SNAPSHOT_INTERVAL_MS) {
    writeSnapshot(ts)
  }

  if (recorder.buffer.length >= FLUSH_BATCH_SIZE) {
    flush()
  }

  if (topic === 'SessionStatus') {
    const status = (data as Record<string, unknown>)?.Status
    if (status === 'Finalised' || status === 'Ends') {
      console.log(`[recorder] Session ${status} — stopping recording`)
      stopRecording()
    }
  }
}

export function startRecording(sessionKey?: string): { sessionKey: string; filePath: string } {
  if (recorder.active) {
    stopRecording()
  }

  ensureDir()

  const { join, writeFileSync } = getNodeModules()
  const key = sessionKey ?? getSessionKey()
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filePath = join(getRecordingsDir(), `${safeKey}.ndjson`)

  recorder.active = true
  recorder.filePath = filePath
  recorder.sessionKey = key
  recorder.startedAt = Date.now()
  recorder.messageCount = 0
  recorder.buffer = []
  recorder.accumulatedState = {}
  recorder.lastSnapshotTs = Date.now()

  const header: RecordingHeader = {
    type: '__header__',
    sessionKey: key,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(filePath, JSON.stringify(header) + '\n')

  recorder.unsubscribeFeed = onFeed(handleMessage)
  recorder.flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)

  console.log(`[recorder] Recording started: ${key} → ${filePath}`)
  return { sessionKey: key, filePath }
}

export async function startRecordingAsync(sessionKey?: string): Promise<{ sessionKey: string; filePath: string }> {
  await ensureNodeModules()
  return startRecording(sessionKey)
}

export function stopRecording(): { messageCount: number; durationMs: number } | null {
  if (!recorder.active) return null

  flush()

  if (recorder.unsubscribeFeed) {
    recorder.unsubscribeFeed()
    recorder.unsubscribeFeed = null
  }
  if (recorder.flushTimer) {
    clearInterval(recorder.flushTimer)
    recorder.flushTimer = null
  }

  const result = {
    messageCount: recorder.messageCount,
    durationMs: Date.now() - recorder.startedAt,
  }

  console.log(`[recorder] Recording stopped: ${recorder.sessionKey} — ${result.messageCount} messages, ${Math.round(result.durationMs / 1000)}s`)

  recorder.active = false
  recorder.filePath = null
  recorder.sessionKey = null
  recorder.accumulatedState = {}

  return result
}

export function isRecording(): boolean {
  return recorder.active
}

export function getRecordingInfo(): { sessionKey: string; messageCount: number; durationMs: number } | null {
  if (!recorder.active || !recorder.sessionKey) return null
  return {
    sessionKey: recorder.sessionKey,
    messageCount: recorder.messageCount,
    durationMs: Date.now() - recorder.startedAt,
  }
}

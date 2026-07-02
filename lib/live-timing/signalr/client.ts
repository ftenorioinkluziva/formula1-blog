import { ensureAuthenticated, getSubscriptionToken } from '../../f1tv/auth'
import {
  SIGNALR_HUB_URL,
  SIGNALR_TOPICS,
  COMPRESSED_TOPICS,
  getCleanTopicName,
} from './topics'
import { F1JsonHubProtocol } from './f1-hub-protocol'


type FeedHandler = (topic: string, data: unknown, timestamp: Date) => void

interface SignalRClientState {
  connection: unknown | null
  isConnected: boolean
  sessionKey: string
  reconnectAttempts: number
  feedHandlers: Set<FeedHandler>
}

const state: SignalRClientState = {
  connection: null,
  isConnected: false,
  sessionKey: 'UnknownSession',
  reconnectAttempts: 0,
  feedHandlers: new Set(),
}

const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_DELAYS_MS = [0, 1000, 2000, 5000, 10000, 15000, 30000]
const SIGNALR_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  Origin: 'https://www.formula1.com',
  Referer: 'https://www.formula1.com/',
}

let inflateRawSyncFn: ((buffer: Buffer) => Buffer) | null = null
let inflateRawSyncPromise: Promise<(buffer: Buffer) => Buffer> | null = null

const importModule = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>

async function ensureInflateRawSync(): Promise<(buffer: Buffer) => Buffer> {
  const isEdgeRuntime = typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== 'undefined'
  if (isEdgeRuntime) {
    throw new Error('SignalR compressed topics are not available in the Edge runtime')
  }

  if (inflateRawSyncFn) {
    return inflateRawSyncFn
  }

  if (inflateRawSyncPromise) {
    return inflateRawSyncPromise
  }

  inflateRawSyncPromise = importModule('node:zlib').then((zlib) => {
    const inflateRawSync = (zlib as { inflateRawSync: (buffer: Buffer) => Buffer }).inflateRawSync
    inflateRawSyncFn = inflateRawSync
    return inflateRawSync
  })

  return inflateRawSyncPromise
}

function getInflateRawSync(): (buffer: Buffer) => Buffer {
  if (!inflateRawSyncFn) {
    throw new Error('inflateRawSync not initialized')
  }

  return inflateRawSyncFn
}

function inflateBase64(data: string): string {
  const buffer = Buffer.from(data, 'base64')
  const inflated = getInflateRawSync()(buffer)
  return inflated.toString('utf-8')
}

function extractJsonObjects(input: string): string[] {
  const segments: string[] = []
  let depth = 0
  let inString = false
  let escaping = false
  let objectStart = -1

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaping) {
      escaping = false
      continue
    }

    if (char === '\\') {
      if (inString) {
        escaping = true
      }
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        objectStart = index
      }
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) {
        continue
      }

      depth -= 1
      if (depth === 0 && objectStart >= 0) {
        const segment = input.slice(objectStart, index + 1).trim()
        if (segment) {
          segments.push(segment)
        }
        objectStart = -1
      }
    }
  }

  if (segments.length > 0) {
    return segments
  }

  const fallbackSegments = input
    .split('\n')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return fallbackSegments.length > 0 ? fallbackSegments : [input.trim()]
}

function decompressIfNeeded(topic: string, data: unknown): unknown {
  if (!COMPRESSED_TOPICS.has(topic)) return data
  if (typeof data !== 'string') return data

  const json = inflateBase64(data)

  try {
    return JSON.parse(json)
  } catch {
    let last: unknown = null
    for (const segment of extractJsonObjects(json)) {
      try {
        last = JSON.parse(segment)
      } catch {
        // skip malformed segments
      }
    }
    if (last !== null) return last
    console.warn(`[signalr/client] Failed to parse compressed ${topic} data`)
    return null
  }
}

async function loadSignalR() {
  return await import('@microsoft/signalr')
}

async function buildConnection() {
  const signalR = await loadSignalR()
  return new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_HUB_URL, {
      accessTokenFactory: () => {
        const token = getSubscriptionToken()
        return token ?? ''
      },
      transport: signalR.HttpTransportType.WebSockets,
      headers: SIGNALR_BROWSER_HEADERS,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        const idx = Math.min(retryContext.previousRetryCount, RECONNECT_DELAYS_MS.length - 1)
        return RECONNECT_DELAYS_MS[idx]
      },
    })
    .withHubProtocol(new F1JsonHubProtocol())
    .configureLogging(signalR.LogLevel.Information)
    .build()
}

function handleFeed(topic: string, rawData: unknown, timestamp: Date): void {
  const cleanTopic = getCleanTopicName(topic)
  const data = decompressIfNeeded(topic, rawData)

  for (const handler of state.feedHandlers) {
    try {
      handler(cleanTopic, data, timestamp)
    } catch (err) {
      console.error(`[signalr/client] Feed handler error for ${cleanTopic}:`, err)
    }
  }
}

function extractSessionKey(subscriptionData: Record<string, unknown>): string {
  const sessionInfo = subscriptionData?.SessionInfo as Record<string, unknown> | undefined
  if (!sessionInfo) return 'UnknownSession'

  const meeting = sessionInfo.Meeting as Record<string, unknown> | undefined
  const location = meeting?.Location ?? 'UnknownLocation'
  const name = sessionInfo.Name ?? 'UnknownName'
  const path = (sessionInfo.Path as string) ?? ''
  const year = path.split('/')[0] || new Date().getFullYear().toString()

  return `${year}_${location}_${name}`.replace(/\s/g, '_')
}

export async function startSignalRClient(): Promise<void> {
  console.log('[signalr/client] Starting live timing client')

  await ensureAuthenticated()
  await ensureInflateRawSync()

  if (state.connection) {
    console.log('[signalr/client] Disposing existing connection')
    await stopSignalRClient()
  }

  const connection = await buildConnection()
  state.connection = connection

  connection.on('feed', (topic: string, data: unknown, timestamp: string) => {
    handleFeed(topic, data, new Date(timestamp))
  })

  connection.onreconnecting((error) => {
    state.isConnected = false
    console.warn('[signalr/client] Reconnecting...', error?.message)
  })

  connection.onreconnected(() => {
    state.isConnected = true
    state.reconnectAttempts = 0
    console.log('[signalr/client] Reconnected')
    subscribeToTopics(connection).catch((err) =>
      console.error('[signalr/client] Re-subscribe failed:', err)
    )
  })

  connection.onclose(async (error) => {
    state.isConnected = false
    if (error) {
      console.error('[signalr/client] Connection closed with error:', error.message)
      if (state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        state.reconnectAttempts++
        const delay = RECONNECT_DELAYS_MS[Math.min(state.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)]
        console.log(`[signalr/client] Manual reconnect attempt ${state.reconnectAttempts} in ${delay}ms`)
        setTimeout(() => startSignalRClient(), delay)
      } else {
        console.error('[signalr/client] Max reconnect attempts reached')
      }
    } else {
      console.log('[signalr/client] Connection closed cleanly')
    }
  })

  await connection.start()
  state.isConnected = true
  state.reconnectAttempts = 0
  console.log('[signalr/client] Connected to F1 Live Timing hub')

  await subscribeToTopics(connection)
}

async function subscribeToTopics(connection: Awaited<ReturnType<typeof buildConnection>>): Promise<void> {
  console.log('[signalr/client] Subscribing to topics:', SIGNALR_TOPICS.join(', '))

  const subscriptionData = await connection.invoke<Record<string, unknown>>(
    'Subscribe',
    [...SIGNALR_TOPICS]
  )

  state.sessionKey = extractSessionKey(subscriptionData)
  console.log(`[signalr/client] Session: ${state.sessionKey}`)

  for (const [topic, data] of Object.entries(subscriptionData)) {
    if (data != null) {
      handleFeed(topic, data, new Date())
    }
  }
}

export async function stopSignalRClient(): Promise<void> {
  if (state.connection) {
    try {
      await (state.connection as { stop: () => Promise<void> }).stop()
    } catch {
      // ignore stop errors
    }
    state.connection = null
    state.isConnected = false
    console.log('[signalr/client] Stopped')
  }
}

export function onFeed(handler: FeedHandler): () => void {
  state.feedHandlers.add(handler)
  return () => {
    state.feedHandlers.delete(handler)
  }
}

export function isConnected(): boolean {
  return state.isConnected
}

export function getSessionKey(): string {
  return state.sessionKey
}

export function getConnectionState(): string | null {
  return (state.connection as { state?: string } | null)?.state ?? null
}

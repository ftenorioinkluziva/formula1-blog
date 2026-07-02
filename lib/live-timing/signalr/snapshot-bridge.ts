import type { F1LiveTimingRawState } from '@/lib/live-timing/types'
import { TOPIC_TO_RAW_STATE_KEY } from './topics'
import { onFeed, isConnected, startSignalRClient } from './client'
import { applyDelta } from '@/lib/live-timing/utils/deep-merge'

type SnapshotListener = (state: F1LiveTimingRawState) => void

interface BridgeState {
  rawState: F1LiveTimingRawState
  lastUpdatedAt: number
  listeners: Set<SnapshotListener>
  unsubscribeFeed: (() => void) | null
  initialized: boolean
}

const bridge: BridgeState = {
  rawState: {},
  lastUpdatedAt: 0,
  listeners: new Set(),
  unsubscribeFeed: null,
  initialized: false,
}

function applyFeedUpdate(topic: string, data: unknown): void {
  const stateKey = TOPIC_TO_RAW_STATE_KEY[topic] ?? topic
  bridge.rawState = applyDelta(
    bridge.rawState as Record<string, unknown>,
    stateKey,
    data,
  ) as F1LiveTimingRawState
  bridge.lastUpdatedAt = Date.now()
}

function handleFeed(topic: string, data: unknown, _timestamp: Date): void {
  if (topic === 'Heartbeat') return

  applyFeedUpdate(topic, data)

  for (const listener of bridge.listeners) {
    try {
      listener(bridge.rawState)
    } catch (err) {
      console.error('[signalr/bridge] Listener error:', err)
    }
  }
}

export async function initSignalRBridge(): Promise<void> {
  if (bridge.initialized) return

  bridge.unsubscribeFeed = onFeed(handleFeed)
  bridge.initialized = true

  if (!isConnected()) {
    await startSignalRClient()
  }

  console.log('[signalr/bridge] Initialized')
}

export function getSignalRSnapshot(): F1LiveTimingRawState {
  return bridge.rawState
}

export function getSignalRSnapshotAge(): number {
  if (bridge.lastUpdatedAt === 0) return Infinity
  return Date.now() - bridge.lastUpdatedAt
}

export function onSignalRSnapshot(listener: SnapshotListener): () => void {
  bridge.listeners.add(listener)
  return () => {
    bridge.listeners.delete(listener)
  }
}

export function isSignalRBridgeActive(): boolean {
  return bridge.initialized && isConnected()
}

export function resetBridge(): void {
  bridge.rawState = {}
  bridge.lastUpdatedAt = 0
  bridge.initialized = false
  if (bridge.unsubscribeFeed) {
    bridge.unsubscribeFeed()
    bridge.unsubscribeFeed = null
  }
  bridge.listeners.clear()
}

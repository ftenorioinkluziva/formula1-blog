import { NextResponse } from 'next/server'
import { ensureAuthenticated, getDecodedToken } from '@/lib/f1tv/auth'
import { LIVE_TIMING_SOURCE } from '@/lib/live-timing/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  let authenticated = false
  try {
    await ensureAuthenticated()
    authenticated = true
  } catch {
    authenticated = false
  }
  const decoded = getDecodedToken()
  const workersRunInThisProcess = process.env.INSTRUMENTATION_WORKERS_ENABLED !== '0'
  const signalR = workersRunInThisProcess
    ? await getSignalRStatus()
    : {
        connected: false,
        sessionKey: null,
        connectionState: 'external-worker',
        bridgeActive: false,
      }
  const scheduler = workersRunInThisProcess
    ? await getSchedulerStatus()
    : {
        running: process.env.AUTO_CONNECT_ENABLED === '1',
        signalRActive: false,
        currentSessionId: null,
        lastCheck: null,
        process: 'external-worker',
      }
  const autoRenewal = workersRunInThisProcess
    ? await getAutoRenewalStatus()
    : {
        running: process.env.F1TV_AUTO_RENEW_ENABLED !== '0',
        renewing: false,
        lastCheck: null,
        lastRenewedSessionId: null,
        nextRunAt: null,
        lastError: null,
        process: 'external-worker',
      }

  return NextResponse.json({
    auth: {
      authenticated,
      name: decoded ? `${decoded.FirstName} ${decoded.LastName}` : null,
      subscription: decoded?.SubscriptionStatus ?? null,
      expiresAt: decoded ? new Date(decoded.exp * 1000).toISOString() : null,
    },
    signalR,
    config: {
      source: LIVE_TIMING_SOURCE,
      autoConnectEnabled: process.env.AUTO_CONNECT_ENABLED === '1',
      f1tvAutoRenewEnabled: process.env.F1TV_AUTO_RENEW_ENABLED !== '0',
      hasF1TVEnvCredentials: Boolean(process.env.F1TV_EMAIL && process.env.F1TV_PASSWORD),
      recordingEnabled: process.env.RECORDING_ENABLED === '1',
      runtime: process.env.NEXT_RUNTIME ?? 'nodejs',
    },
    scheduler,
    autoRenewal,
  })
}

async function getSignalRStatus() {
  const [{ isConnected, getSessionKey, getConnectionState }, { isSignalRBridgeActive }] =
    await Promise.all([
      importRuntime<typeof import('@/lib/live-timing/signalr/client')>('@/lib/live-timing/signalr/client'),
      importRuntime<typeof import('@/lib/live-timing/signalr/snapshot-bridge')>('@/lib/live-timing/signalr/snapshot-bridge'),
    ])

  return {
    connected: isConnected(),
    sessionKey: getSessionKey(),
    connectionState: getConnectionState(),
    bridgeActive: isSignalRBridgeActive(),
  }
}

async function getSchedulerStatus() {
  const { getSchedulerStatus } =
    await importRuntime<typeof import('@/lib/live-timing/scheduler')>('@/lib/live-timing/scheduler')
  return getSchedulerStatus()
}

async function getAutoRenewalStatus() {
  const { getF1TVAutoRenewalStatus } =
    await importRuntime<typeof import('@/lib/f1tv/auto-renewal-scheduler')>('@/lib/f1tv/auto-renewal-scheduler')
  return getF1TVAutoRenewalStatus()
}

async function importRuntime<T>(specifier: string): Promise<T> {
  const importer = new Function("specifier", "return import(specifier)") as (value: string) => Promise<T>
  return importer(specifier)
}

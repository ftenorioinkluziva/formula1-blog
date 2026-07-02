import { NextResponse } from 'next/server'
import { ensureAuthenticated, getDecodedToken } from '@/lib/f1tv/auth'
import { isConnected, getSessionKey, getConnectionState } from '@/lib/live-timing/signalr/client'
import { isSignalRBridgeActive } from '@/lib/live-timing/signalr/snapshot-bridge'
import { getSchedulerStatus } from '@/lib/live-timing/scheduler'
import { getF1TVAutoRenewalStatus } from '@/lib/f1tv/auto-renewal-scheduler'
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
  const scheduler = getSchedulerStatus()
  const autoRenewal = getF1TVAutoRenewalStatus()

  return NextResponse.json({
    auth: {
      authenticated,
      name: decoded ? `${decoded.FirstName} ${decoded.LastName}` : null,
      subscription: decoded?.SubscriptionStatus ?? null,
      expiresAt: decoded ? new Date(decoded.exp * 1000).toISOString() : null,
    },
    signalR: {
      connected: isConnected(),
      sessionKey: getSessionKey(),
      connectionState: getConnectionState(),
      bridgeActive: isSignalRBridgeActive(),
    },
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

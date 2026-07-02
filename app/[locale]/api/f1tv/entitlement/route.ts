import { NextResponse } from 'next/server'
import { ensureAuthenticated } from '@/lib/f1tv/auth'
import { refreshEntitlement, getClientState, refreshLocation } from '@/lib/f1tv/client'

export const dynamic = 'force-dynamic'

// Returns tokens needed for the browser to call F1TV content/play directly.
// The actual play URL fetch must happen client-side (user's IP) to avoid 451 geo-blocks.
export async function GET() {
  try {
    const subscriptionToken = await ensureAuthenticated()

    if (!getClientState().entitlementToken) {
      await refreshEntitlement(subscriptionToken)
    }

    if (!getClientState().location) {
      await refreshLocation(subscriptionToken)
    }

    const { entitlementToken, location } = getClientState()

    return NextResponse.json({
      subscriptionToken,
      entitlementToken,
      location: location?.userLocation?.[0] ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

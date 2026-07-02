import { NextRequest, NextResponse } from 'next/server'
import { ensureAuthenticated } from '@/lib/f1tv/auth'

export const dynamic = 'force-dynamic'

function sanitizeLicenseUrl(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname !== 'f1tv.formula1.com') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const laUrl = sanitizeLicenseUrl(request.nextUrl.searchParams.get('laURL'))
  if (!laUrl) {
    return NextResponse.json({ error: 'Invalid laURL' }, { status: 400 })
  }

  const drmToken = request.headers.get('x-f1tv-drm-token')
  if (!drmToken) {
    return NextResponse.json({ error: 'Missing DRM token' }, { status: 401 })
  }

  try {
    const subscriptionToken = await ensureAuthenticated()
    const payload = Buffer.from(await request.arrayBuffer())
    const upstream = await fetch(laUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') ?? 'application/octet-stream',
        Authorization: `Bearer ${drmToken}`,
        entitlementtoken: drmToken,
        ascendontoken: subscriptionToken,
      },
      body: payload,
      cache: 'no-store',
    })

    const responseBuffer = Buffer.from(await upstream.arrayBuffer())
    return new NextResponse(responseBuffer, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'License request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
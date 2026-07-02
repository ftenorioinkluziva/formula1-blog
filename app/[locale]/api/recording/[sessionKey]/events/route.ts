import { NextRequest, NextResponse } from 'next/server'
import { extractTimelineEvents } from '@/lib/live-timing/recording/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> },
) {
  const { sessionKey } = await params
  const events = extractTimelineEvents(sessionKey)
  return NextResponse.json(events)
}

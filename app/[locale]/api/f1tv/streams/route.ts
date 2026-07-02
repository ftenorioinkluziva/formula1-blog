import { NextRequest, NextResponse } from 'next/server'
import { getContentPlayUrl } from '@/lib/f1tv/client'
import { ensureAuthenticated } from '@/lib/f1tv/auth'
import { createPlaybackStream } from '@/lib/f1tv/playback'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()
  } catch {
    return NextResponse.json(
      { error: 'F1TV not authenticated. Set F1TV_TOKEN in .env.local' },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const contentId = url.searchParams.get('contentId')
  const channelId = url.searchParams.get('channelId')

  if (!contentId) {
    return NextResponse.json(
      { error: 'contentId is required' },
      { status: 400 }
    )
  }

  try {
    const numericContentId = Number(contentId)
    const numericChannelId = channelId ? Number(channelId) : undefined
    const playResult = await getContentPlayUrl(numericContentId, numericChannelId)

    return NextResponse.json(createPlaybackStream(playResult))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[f1tv/streams] Error:', message)
    return NextResponse.json(
      { error: message, contentId, channelId: channelId ?? null },
      { status: 502 }
    )
  }
}

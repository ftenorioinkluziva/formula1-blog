import { NextResponse } from 'next/server'
import { getLiveNow } from '@/lib/f1tv/client'
import { ensureAuthenticated } from '@/lib/f1tv/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureAuthenticated()
  } catch {
    return NextResponse.json(
      { error: 'F1TV not authenticated. Set F1TV_TOKEN in .env.local' },
      { status: 401 }
    )
  }

  try {
    const result = await getLiveNow()

    const sessions = result.items.map((item) => ({
      contentId: item.metadata.contentId,
      title: item.metadata.title,
      meeting: item.metadata.emfAttributes.Meeting_Name,
      location: item.metadata.emfAttributes.Meeting_Location,
      state: item.metadata.emfAttributes.state,
      isOnAir: item.metadata.isOnAir,
    }))

    return NextResponse.json({ sessions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

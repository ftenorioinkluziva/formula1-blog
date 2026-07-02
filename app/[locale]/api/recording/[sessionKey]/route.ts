import { NextRequest, NextResponse } from 'next/server'
import { getRecording, deleteRecording } from '@/lib/live-timing/recording/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> },
) {
  const { sessionKey } = await params
  const content = getRecording(sessionKey)

  if (!content) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': `inline; filename="${sessionKey}.ndjson"`,
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> },
) {
  const { sessionKey } = await params
  const deleted = deleteRecording(sessionKey)

  if (!deleted) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

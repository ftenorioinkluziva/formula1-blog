import { NextRequest, NextResponse } from 'next/server'
import { listRecordings } from '@/lib/live-timing/recording/storage'
import { startRecordingAsync, stopRecording, isRecording, getRecordingInfo } from '@/lib/live-timing/recording/recorder'

export const dynamic = 'force-dynamic'

export async function GET() {
  const recordings = listRecordings()
  const current = getRecordingInfo()

  return NextResponse.json({
    recordings,
    isRecording: isRecording(),
    current,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { action: string }

  if (body.action === 'start') {
    if (isRecording()) {
      return NextResponse.json({ error: 'Already recording' }, { status: 409 })
    }
    const result = await startRecordingAsync()
    return NextResponse.json({ started: true, ...result })
  }

  if (body.action === 'stop') {
    const result = stopRecording()
    if (!result) {
      return NextResponse.json({ error: 'No active recording' }, { status: 404 })
    }
    return NextResponse.json({ stopped: true, ...result })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

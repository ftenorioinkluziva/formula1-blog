import { NextRequest, NextResponse } from 'next/server'
import { listRecordings } from '@/lib/live-timing/recording/storage'
import { startRecordingAsync, stopRecording, isRecording, getRecordingInfo } from '@/lib/live-timing/recording/recorder'
import { requireAdmin, requireUser } from '@/lib/auth/guards'
import { logAdminAction } from '@/lib/db/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireUser()
  if (session instanceof Response) return session

  const recordings = listRecordings()
  const current = getRecordingInfo()

  return NextResponse.json({
    recordings,
    isRecording: isRecording(),
    current,
  })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (session instanceof Response) return session

  const body = await request.json() as { action: string }

  if (body.action === 'start') {
    if (isRecording()) {
      return NextResponse.json({ error: 'Already recording' }, { status: 409 })
    }
    const result = await startRecordingAsync()

    // Log recording start
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "admin",
      action: "start_recording",
      targetType: "recording",
      metadataJson: { result },
    })

    return NextResponse.json({ started: true, ...result })
  }

  if (body.action === 'stop') {
    const result = stopRecording()
    if (!result) {
      return NextResponse.json({ error: 'No active recording' }, { status: 404 })
    }

    // Log recording stop
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "admin",
      action: "stop_recording",
      targetType: "recording",
      metadataJson: { result },
    })

    return NextResponse.json({ stopped: true, ...result })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getRecording, deleteRecording } from '@/lib/live-timing/recording/storage'
import { requireAdmin, requireUser } from '@/lib/auth/guards'
import { logAdminAction } from '@/lib/db/audit'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> },
) {
  const session = await requireUser()
  if (session instanceof Response) return session

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
  const session = await requireAdmin()
  if (session instanceof Response) return session

  const { sessionKey } = await params
  const deleted = deleteRecording(sessionKey)

  if (!deleted) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  // Log recording deletion
  await logAdminAction({
    actorUserId: session.user.id,
    actorRole: session.profile?.role || "admin",
    action: "delete_recording",
    targetType: "recording",
    targetId: sessionKey,
  })

  return NextResponse.json({ deleted: true })
}

import { NextResponse } from "next/server"
import { getDb } from "@/lib/db/client"
import { f1tvSyncPoints } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const sessionId = parseInt(searchParams.get("sessionId") ?? "", 10)
  const contentId = parseInt(searchParams.get("contentId") ?? "", 10)
  const channelIdParam = searchParams.get("channelId")
  const channelId = channelIdParam ? parseInt(channelIdParam, 10) : null

  if (!sessionId || !contentId) {
    return NextResponse.json({ error: "sessionId and contentId required" }, { status: 400 })
  }

  const db = getDb()
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 })

  const conditions = [
    eq(f1tvSyncPoints.sessionId, sessionId),
    eq(f1tvSyncPoints.contentId, contentId),
    channelId !== null
      ? eq(f1tvSyncPoints.channelId, channelId)
      : isNull(f1tvSyncPoints.channelId),
  ]

  const rows = await db
    .select()
    .from(f1tvSyncPoints)
    .where(and(...conditions))
    .limit(1)

  if (!rows[0]) return NextResponse.json({ sync: null })

  return NextResponse.json({
    sync: {
      streamStartUtc: rows[0].streamStartUtc,
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireAdmin()
  if (session instanceof Response) return session

  const body = await request.json()
  const { sessionId, contentId, channelId, streamStartUtc } = body as {
    sessionId: number
    contentId: number
    channelId: number | null
    streamStartUtc: string
  }

  if (!sessionId || !contentId || !streamStartUtc) {
    return NextResponse.json({ error: "sessionId, contentId and streamStartUtc required" }, { status: 400 })
  }

  const db = getDb()
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 })

  const channelCondition = channelId !== null
    ? eq(f1tvSyncPoints.channelId, channelId)
    : isNull(f1tvSyncPoints.channelId)

  const existing = await db
    .select({ id: f1tvSyncPoints.id })
    .from(f1tvSyncPoints)
    .where(
      and(
        eq(f1tvSyncPoints.sessionId, sessionId),
        eq(f1tvSyncPoints.contentId, contentId),
        channelCondition,
      ),
    )
    .limit(1)

  const streamDate = new Date(streamStartUtc)

  if (existing[0]) {
    await db
      .update(f1tvSyncPoints)
      .set({ streamStartUtc: streamDate, updatedAt: new Date() })
      .where(eq(f1tvSyncPoints.id, existing[0].id))
  } else {
    await db.insert(f1tvSyncPoints).values({
      sessionId,
      contentId,
      channelId: channelId ?? null,
      streamStartUtc: streamDate,
    })
  }

  return NextResponse.json({ ok: true })
}

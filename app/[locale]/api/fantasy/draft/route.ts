import { NextRequest, NextResponse } from "next/server"
import { ensureFantasyDraft } from "@/lib/db/fantasy-draft"
import { requireUser } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      displayName?: string
    }

    const season = body.season
    const round = body.round

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const result = await ensureFantasyDraft(season, round, userId, body.displayName || session.user.name || undefined)

    if (!result) {
      return NextResponse.json({ error: "Unable to create fantasy draft" }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        id: result.profile.id,
        displayName: result.profile.displayName,
        userId: result.profile.userId,
      },
      entry: result.entry,
      draftStatus: result.entry.status,
      weekend: {
        id: result.context.weekendId,
        name: result.context.weekendName,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create fantasy draft"
    const status = message === "lock_closed" ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { ensureFantasyDraft } from "@/lib/db/fantasy-draft"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      sessionKey?: string
      displayName?: string
    }

    const season = body.season
    const round = body.round
    const sessionKey = body.sessionKey?.trim()

    if (!season || !round || !sessionKey) {
      return NextResponse.json({ error: "season, round and sessionKey required" }, { status: 400 })
    }

    const result = await ensureFantasyDraft(season, round, sessionKey, body.displayName)

    if (!result) {
      return NextResponse.json({ error: "Unable to create fantasy draft" }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        id: result.profile.id,
        displayName: result.profile.displayName,
        sessionKey: result.profile.sessionKey,
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
import { NextRequest, NextResponse } from "next/server"
import { lockFantasyEntry } from "@/lib/db/fantasy-draft"
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
    }

    if (!body.season || !body.round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const result = await lockFantasyEntry(body.season, body.round, userId)

    if (!result) {
      return NextResponse.json({ error: "Unable to lock fantasy entry" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to lock fantasy entry"
    const status = message === "entry_not_eligible_for_lock" || message === "lock_closed" ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
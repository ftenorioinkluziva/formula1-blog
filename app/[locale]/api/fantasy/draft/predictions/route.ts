import { NextRequest, NextResponse } from "next/server"
import { getFantasyPredictionOptions, saveFantasyPredictions, type FantasyPredictionsInput } from "@/lib/db/fantasy-draft"
import { requireUser } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const response = await getFantasyPredictionOptions(season, round, userId)

    if (!response) {
      return NextResponse.json({ error: "Fantasy prediction options not found" }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load fantasy predictions"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      predictions?: FantasyPredictionsInput
    }

    if (!body.season || !body.round || !body.predictions) {
      return NextResponse.json({ error: "season, round and predictions required" }, { status: 400 })
    }

    const result = await saveFantasyPredictions(body.season, body.round, userId, body.predictions)

    if (!result) {
      return NextResponse.json({ error: "Unable to save fantasy predictions" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save fantasy predictions"
    const status = message === "entry_locked" || message === "lock_closed" ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
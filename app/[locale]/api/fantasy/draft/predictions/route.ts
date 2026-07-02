import { NextRequest, NextResponse } from "next/server"
import { getFantasyPredictionOptions, saveFantasyPredictions, type FantasyPredictionsInput } from "@/lib/db/fantasy-draft"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)
    const sessionKey = searchParams.get("sessionKey") ?? ""

    if (!season || !round || !sessionKey) {
      return NextResponse.json({ error: "season, round and sessionKey required" }, { status: 400 })
    }

    const response = await getFantasyPredictionOptions(season, round, sessionKey)

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
  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      sessionKey?: string
      predictions?: FantasyPredictionsInput
    }

    if (!body.season || !body.round || !body.sessionKey || !body.predictions) {
      return NextResponse.json({ error: "season, round, sessionKey and predictions required" }, { status: 400 })
    }

    const result = await saveFantasyPredictions(body.season, body.round, body.sessionKey, body.predictions)

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
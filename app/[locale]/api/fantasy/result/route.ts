import { NextResponse } from "next/server"
import { getFantasyRoundResult } from "@/lib/db/fantasy-draft"

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

    const result = await getFantasyRoundResult(season, round, sessionKey)

    if (!result) {
      return NextResponse.json({ error: "Fantasy result not found" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load fantasy result"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
import { NextResponse } from "next/server"
import { getFantasyLeaderboard } from "@/lib/db/fantasy-leaderboard"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)
    const sessionKey = searchParams.get("sessionKey") ?? undefined

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const leaderboard = await getFantasyLeaderboard(season, round, sessionKey)

    if (!leaderboard) {
      return NextResponse.json({ error: "Fantasy leaderboard not found" }, { status: 404 })
    }

    return NextResponse.json(leaderboard)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load fantasy leaderboard"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
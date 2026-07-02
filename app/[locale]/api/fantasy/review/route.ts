import { NextResponse } from "next/server"
import { getFantasyReviewState } from "@/lib/db/fantasy-draft"

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

    const review = await getFantasyReviewState(season, round, sessionKey)

    if (!review) {
      return NextResponse.json({ error: "Fantasy review state not found" }, { status: 404 })
    }

    return NextResponse.json(review)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load review state"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
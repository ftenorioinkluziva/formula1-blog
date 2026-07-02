import { NextResponse } from "next/server"
import { getFantasyPitWallLeadAssets } from "@/lib/db/fantasy-assets"

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

    const response = await getFantasyPitWallLeadAssets(season, round, sessionKey)

    if (!response) {
      return NextResponse.json({ error: "Pit Wall Leads not found" }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load pit wall leads"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
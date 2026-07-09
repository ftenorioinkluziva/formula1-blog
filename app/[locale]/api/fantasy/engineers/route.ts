import { NextResponse } from "next/server"
import { getFantasyPitWallLeadAssets } from "@/lib/db/fantasy-assets"
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

    const response = await getFantasyPitWallLeadAssets(season, round, userId)

    if (!response) {
      return NextResponse.json({ error: "Pit Wall Leads not found" }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load pit wall leads"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
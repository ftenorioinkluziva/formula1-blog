import { NextResponse } from "next/server"
import { getFantasyDriverAssets, getFantasyTeamAssets } from "@/lib/db/fantasy-assets"
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
    const type = searchParams.get("type")

    if (!season || !round || !type) {
      return NextResponse.json({ error: "season, round and type required" }, { status: 400 })
    }

    const response =
      type === "driver"
        ? await getFantasyDriverAssets(season, round, userId)
        : type === "team"
          ? await getFantasyTeamAssets(season, round, userId)
          : null

    if (!response) {
      return NextResponse.json({ error: "Fantasy assets not found" }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load fantasy assets"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
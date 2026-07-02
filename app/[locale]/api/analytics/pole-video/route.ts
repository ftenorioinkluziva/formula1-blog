import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { poleVideos } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const db = getDb()!

    const rows = await db
      .select({ cloudinaryUrl: poleVideos.cloudinaryUrl })
      .from(poleVideos)
      .where(and(eq(poleVideos.season, season), eq(poleVideos.round, round)))
      .limit(1)

    if (rows.length === 0) {
      return NextResponse.json({ error: "No pole video found" }, { status: 404 })
    }

    return NextResponse.json({ url: rows[0].cloudinaryUrl })
  } catch {
    return NextResponse.json({ error: "Failed to fetch pole video" }, { status: 500 })
  }
}

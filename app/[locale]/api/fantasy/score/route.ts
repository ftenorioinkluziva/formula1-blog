import { NextRequest, NextResponse } from "next/server"
import { scoreFantasyRound } from "@/lib/db/fantasy-scoring"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return NextResponse.json({ error: "Unauthorized: ADMIN_SECRET not configured on server" }, { status: 401 })
  }

  const headerSecret = request.headers.get("x-admin-secret")
  if (headerSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      sessionKey?: string
    }

    if (!body.season || !body.round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const result = await scoreFantasyRound(body.season, body.round, body.sessionKey)

    if (!result) {
      return NextResponse.json({ error: "Unable to score fantasy round" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to score fantasy round"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { runFantasyPostRound } from "@/lib/fantasy/post-round-pipeline"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
    }

    const season = body.season ?? 2026
    const round = body.round

    if (!round) {
      return NextResponse.json({ error: "round is required" }, { status: 400 })
    }

    const result = await runFantasyPostRound({
      season,
      round,
      requireRaceResults: true,
      includeScoring: true,
      evolvePrices: true,
    })

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-round pipeline failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

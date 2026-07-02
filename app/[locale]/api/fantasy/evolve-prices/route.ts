import { NextRequest, NextResponse } from "next/server"
import { evolveFantasyPrices } from "@/lib/db/fantasy-pricing"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      fromRound?: number
      toRound?: number
    }

    if (!body.season || !body.fromRound || !body.toRound) {
      return NextResponse.json({ error: "season, fromRound and toRound required" }, { status: 400 })
    }

    if (body.toRound <= body.fromRound) {
      return NextResponse.json({ error: "toRound must be greater than fromRound" }, { status: 400 })
    }

    const result = await evolveFantasyPrices(body.season, body.fromRound, body.toRound)

    if (!result) {
      return NextResponse.json({ error: "Unable to evolve prices" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evolve fantasy prices"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

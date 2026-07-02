import { NextRequest, NextResponse } from "next/server"
import { getLapSummaries } from "@/lib/db/lap-summaries"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

function parseSessionId(value: string): number | null {
  const numeric = Number(value)

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

function parseLimit(value: string | null, max = 2000): number {
  if (!value) return 400

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 400

  return Math.min(Math.floor(parsed), max)
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const { sessionId } = await context.params
    const parsedSessionId = parseSessionId(sessionId)

    if (!parsedSessionId) {
      return NextResponse.json(
        { error: "Invalid sessionId" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
    const laps = await getLapSummaries(parsedSessionId, limit)

    return NextResponse.json(
      {
        sessionId: parsedSessionId,
        laps,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading lap summaries" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

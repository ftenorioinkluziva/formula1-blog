import { NextRequest, NextResponse } from "next/server"
import { getRaceControlMessages } from "@/lib/db/race-control-messages"

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

function parseLimit(value: string | null, max = 500): number {
  if (!value) return 100

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 100

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
    const messages = await getRaceControlMessages(parsedSessionId, limit)

    return NextResponse.json(
      {
        sessionId: parsedSessionId,
        messages,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading race control messages" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

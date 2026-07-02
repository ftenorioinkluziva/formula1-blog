import { NextResponse } from "next/server"
import { getSessionStatusTimeline } from "@/lib/db/session-status-events"

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

export async function GET(
  _: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { sessionId } = await context.params
    const parsedSessionId = parseSessionId(sessionId)

    if (!parsedSessionId) {
      return NextResponse.json(
        { error: "Invalid sessionId" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }

    const timeline = await getSessionStatusTimeline(parsedSessionId)

    return NextResponse.json(
      {
        sessionId: parsedSessionId,
        timeline,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading session status timeline" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

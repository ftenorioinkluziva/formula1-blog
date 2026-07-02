import { NextResponse } from "next/server"
import { getSessionResults } from "@/lib/db/session-results"

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

    const results = await getSessionResults(parsedSessionId)

    return NextResponse.json(
      {
        sessionId: parsedSessionId,
        results,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading session results" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

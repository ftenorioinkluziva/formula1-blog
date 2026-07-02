import { NextResponse } from "next/server"
import { getSessionAnalyticsOverview } from "@/lib/db/session-analytics"
import { getSharedLiveTimingSnapshot } from "@/lib/live-timing/persistence/live-timing-snapshot-store"
import { parseDateOrNull, resolveLiveSessionId } from "@/lib/db/live-session-resolver"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const snapshot = await getSharedLiveTimingSnapshot(false)

    if (!snapshot) {
      return NextResponse.json(
        { error: "Live timing snapshot unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }

    const capturedAt = parseDateOrNull(snapshot.capturedAtIso) ?? new Date()
    const sessionId = await resolveLiveSessionId(snapshot.rawState, capturedAt)

    if (!sessionId) {
      return NextResponse.json(
        {
          sessionId: null,
          overview: null,
          message: "No active mapped session",
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    const overview = await getSessionAnalyticsOverview(sessionId)

    return NextResponse.json(
      {
        sessionId,
        overview,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading current session analytics" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

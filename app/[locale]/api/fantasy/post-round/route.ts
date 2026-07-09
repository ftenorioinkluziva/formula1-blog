import { NextRequest, NextResponse } from "next/server"
import { runFantasyPostRound } from "@/lib/fantasy/post-round-pipeline"
import { requireAdmin } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest): Promise<Response> {
  let actorUserId = "system:admin-secret"
  let actorRole = "admin"

  const authSession = await requireAdmin()
  if (authSession instanceof Response) {
    const adminSecret = process.env.ADMIN_SECRET
    const headerSecret = request.headers.get("x-admin-secret")
    if (!adminSecret || headerSecret !== adminSecret) {
      return authSession
    }
  } else {
    actorUserId = authSession.user.id
    actorRole = authSession.profile?.role || "admin"
  }

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

    // Log the fantasy post-round action
    await logAdminAction({
      actorUserId,
      actorRole,
      action: "fantasy_post_round",
      targetType: "fantasy_round",
      targetId: `${season}-${round}`,
      metadataJson: result as any,
    })

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-round pipeline failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

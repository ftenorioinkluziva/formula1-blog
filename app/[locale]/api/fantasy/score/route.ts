import { NextRequest, NextResponse } from "next/server"
import { scoreFantasyRound } from "@/lib/db/fantasy-scoring"
import { requireAdmin } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

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
      userId?: string
    }

    if (!body.season || !body.round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const result = await scoreFantasyRound(body.season, body.round, body.userId)

    if (!result) {
      return NextResponse.json({ error: "Unable to score fantasy round" }, { status: 404 })
    }

    // Log the fantasy scoring action
    await logAdminAction({
      actorUserId,
      actorRole,
      action: "fantasy_score_round",
      targetType: "fantasy_round",
      targetId: `${body.season}-${body.round}`,
      metadataJson: { userId: body.userId, result },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to score fantasy round"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { evolveFantasyPrices } from "@/lib/db/fantasy-pricing"
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

    // Log the fantasy price evolution action
    await logAdminAction({
      actorUserId,
      actorRole,
      action: "fantasy_evolve_prices",
      targetType: "fantasy_round",
      targetId: `${body.season}-${body.fromRound}`,
      metadataJson: { toRound: body.toRound, result },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evolve fantasy prices"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

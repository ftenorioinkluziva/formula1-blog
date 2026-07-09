import { NextRequest, NextResponse } from "next/server"
import { upsertFantasyHolding, removeFantasyHolding } from "@/lib/db/fantasy-draft"
import { requireUser } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      slotType?: "driver_1" | "team" | "driver_2" | "engineer"
      assetId?: number
    }

    if (!body.season || !body.round || !body.slotType || !body.assetId) {
      return NextResponse.json({ error: "season, round, slotType and assetId required" }, { status: 400 })
    }

    const result = await upsertFantasyHolding(body.season, body.round, userId, body.slotType, body.assetId)

    if (!result) {
      return NextResponse.json({ error: "Unable to update lineup" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lineup"
    const status =
      message === "asset_not_found" ||
      message === "asset_type_mismatch" ||
      message === "driver_already_selected" ||
      message === "entry_locked" ||
      message === "lock_closed" ||
      message === "team_locked" ||
      message === "no_driver_transfers_left" ||
      message === "no_engineer_transfers_left"
        ? 400
        : 500

    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
      slotType?: "driver_1" | "team" | "driver_2" | "engineer"
    }

    if (!body.season || !body.round || !body.slotType) {
      return NextResponse.json({ error: "season, round and slotType required" }, { status: 400 })
    }

    const result = await removeFantasyHolding(body.season, body.round, userId, body.slotType)

    if (!result) {
      return NextResponse.json({ error: "Unable to update lineup" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lineup"
    const status =
      message === "entry_locked" ||
      message === "team_locked" ||
      message === "no_driver_transfers_left" ||
      message === "no_engineer_transfers_left"
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
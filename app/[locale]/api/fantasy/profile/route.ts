import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { fantasyProfiles } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionKey?: string
      displayName?: string
    }

    const sessionKey = body.sessionKey?.trim()
    const displayName = body.displayName?.trim()

    if (!sessionKey || !displayName) {
      return NextResponse.json({ error: "sessionKey and displayName required" }, { status: 400 })
    }

    const db = getDb()

    if (!db) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 })
    }

    const [updated] = await db
      .update(fantasyProfiles)
      .set({
        displayName,
        updatedAt: new Date(),
      })
      .where(eq(fantasyProfiles.sessionKey, sessionKey))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updated.id,
        displayName: updated.displayName,
        sessionKey: updated.sessionKey,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

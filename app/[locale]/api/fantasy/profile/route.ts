import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { fantasyProfiles } from "@/lib/db/schema"
import { requireUser } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const body = (await request.json().catch(() => ({}))) as {
      displayName?: string
    }

    const displayName = body.displayName?.trim()

    if (!displayName) {
      return NextResponse.json({ error: "displayName required" }, { status: 400 })
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
      .where(eq(fantasyProfiles.userId, userId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updated.id,
        displayName: updated.displayName,
        userId: updated.userId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

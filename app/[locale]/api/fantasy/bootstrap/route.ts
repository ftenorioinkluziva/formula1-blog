import { NextResponse } from "next/server"
import { getFantasyContext, getFantasyEntry, getFantasyProfileByUserId } from "@/lib/db/fantasy-core"
import { requireUser } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const session = await requireUser()
  if (session instanceof Response) return session
  const userId = session.user.id

  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const context = await getFantasyContext(season, round)

    if (!context) {
      return NextResponse.json({ error: "Fantasy context not found" }, { status: 404 })
    }

    const profile = await getFantasyProfileByUserId(userId)
    
    if (profile && session.user.name && profile.displayName !== session.user.name) {
      const { getDb } = await import("@/lib/db/client")
      const { fantasyProfiles } = await import("@/lib/db/schema")
      const { eq } = await import("drizzle-orm")
      const dbClient = getDb()
      if (dbClient) {
        try {
          await dbClient
            .update(fantasyProfiles)
            .set({ displayName: session.user.name, updatedAt: new Date() })
            .where(eq(fantasyProfiles.id, profile.id))
          profile.displayName = session.user.name
        } catch (err) {
          console.warn("Failed to sync profile displayName with session name:", err)
        }
      }
    }

    const entry = profile ? await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId) : null

    return NextResponse.json({
      season,
      round,
      weekend: {
        id: context.weekendId,
        grandPrixName: context.weekendName,
        circuit: context.circuit,
        country: context.country,
        location: context.location,
      },
      profile: profile ? {
        id: profile.id,
        displayName: profile.displayName,
        userId: profile.userId,
      } : null,
      lockStatus: context.lockStatus,
      lockAt: context.lockAt,
      budgetCap: context.budgetCap,
      rosterSlots: ["driver_1", "team", "driver_2", "engineer"],
      hasExistingDraft: Boolean(entry),
      draftStatus: entry?.status ?? null,
      scoreWeightsSummary: {
        drivers: 45,
        team: 20,
        engineer: 20,
        predictions: 15,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load fantasy bootstrap"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
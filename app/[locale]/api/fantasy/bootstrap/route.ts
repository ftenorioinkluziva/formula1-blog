import { NextResponse } from "next/server"
import { getFantasyContext, getFantasyEntry, getFantasyProfileBySessionKey } from "@/lib/db/fantasy-core"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get("season") ?? "", 10)
    const round = parseInt(searchParams.get("round") ?? "", 10)
    const sessionKey = searchParams.get("sessionKey") ?? undefined

    if (!season || !round) {
      return NextResponse.json({ error: "season and round required" }, { status: 400 })
    }

    const context = await getFantasyContext(season, round)

    if (!context) {
      return NextResponse.json({ error: "Fantasy context not found" }, { status: 404 })
    }

    const profile = sessionKey ? await getFantasyProfileBySessionKey(sessionKey) : null
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
        sessionKey: profile.sessionKey,
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
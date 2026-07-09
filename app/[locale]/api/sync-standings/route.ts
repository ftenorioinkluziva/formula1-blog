import { NextRequest, NextResponse } from "next/server"
import { fetchDriverStandings, fetchConstructorStandings, fetchRaceResults } from "@/lib/jolpica/client"
import { syncDriverStandings, syncConstructorStandings, syncPodiumsFromResults } from "@/lib/db/standings"
import { requireAdmin } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireAdmin()
  if (session instanceof Response) return session

  try {
    const body = (await request.json().catch(() => ({}))) as { season?: number; round?: number }
    const season = body.season ?? new Date().getFullYear()
    const round = body.round

    // Sync driver standings
    const driverStandings = await fetchDriverStandings(season)
    const driverResult = await syncDriverStandings(driverStandings)

    // Sync constructor standings
    const constructorStandings = await fetchConstructorStandings(season)
    const teamResult = await syncConstructorStandings(constructorStandings)

    // Optionally sync podiums from specific round
    let podiumResult = null
    let winner: string | null = null

    if (round) {
      const race = await fetchRaceResults(season, round)

      if (race) {
        podiumResult = await syncPodiumsFromResults(race.Results)
        const first = race.Results[0]

        if (first) {
          winner = `${first.Driver.givenName} ${first.Driver.familyName}`
        }
      }
    }

    return NextResponse.json(
      {
        season,
        drivers: driverResult,
        teams: teamResult,
        ...(round ? { round, podiums: podiumResult, winner } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

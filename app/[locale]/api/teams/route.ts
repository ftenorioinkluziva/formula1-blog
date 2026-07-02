import { NextResponse } from "next/server"
import { getTeamsList } from "@/lib/db/teams"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const teams = await getTeamsList()

    return NextResponse.json(
      { teams },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { teams: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

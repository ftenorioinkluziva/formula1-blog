import { NextResponse } from "next/server"
import { getRaceWeekendsCalendar } from "@/lib/db/race-weekends"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const races = await getRaceWeekendsCalendar()

    return NextResponse.json(
      { races },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { races: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

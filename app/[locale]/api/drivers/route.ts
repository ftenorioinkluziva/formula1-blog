import { NextResponse } from "next/server"
import { getDriversList } from "@/lib/db/drivers"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const drivers = await getDriversList()

    return NextResponse.json(
      { drivers },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { drivers: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

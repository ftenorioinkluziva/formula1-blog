import { NextResponse } from "next/server"
import { getSessionBannerPayloadCached } from "@/lib/cache/session-banner-cache"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const banner = await getSessionBannerPayloadCached()

    return NextResponse.json(
      { banner },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { banner: null },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

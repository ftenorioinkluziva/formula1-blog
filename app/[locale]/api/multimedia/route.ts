import { NextResponse } from "next/server"
import { getMultimediaContent } from "@/lib/db/multimedia"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const content = await getMultimediaContent()

    return NextResponse.json(content, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { videos: [], galleries: [], podcasts: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

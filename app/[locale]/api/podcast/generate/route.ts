import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      season?: number
      round?: number
    }

    const { generatePodcastForRace } = await import("@/lib/podcast/pipeline")
    const result = await generatePodcastForRace({
      season: body.season,
      round: body.round,
    })

    return NextResponse.json({
      success: true,
      podcastId: result.podcastId,
      audioUrl: result.audioUrl,
      title: result.title,
      duration: result.duration,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

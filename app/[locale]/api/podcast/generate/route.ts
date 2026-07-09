import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest): Promise<Response> {
  const session = await requireAdmin()
  if (session instanceof Response) return session

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

    // Log the podcast generation action
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "admin",
      action: "generate_podcast",
      targetType: "podcast",
      targetId: result.podcastId ? String(result.podcastId) : undefined,
      metadataJson: { season: body.season, round: body.round, title: result.title },
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

import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  createAdminGallery,
  listAdminGalleries,
  parseGalleryInput,
} from "@/lib/db/multimedia-admin"
import { requireAnyRole } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

function handleError(error: unknown): Response {
  if (error instanceof AdminGalleryError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json({ error: "Erro ao processar galeria." }, { status: 500 })
}

export async function GET(): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const galleries = await listAdminGalleries()
    return NextResponse.json({ galleries }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const input = parseGalleryInput(await req.json())
    const id = await createAdminGallery(input)

    // Log the gallery creation
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "create_gallery",
      targetType: "gallery",
      targetId: String(id),
      metadataJson: { title: input.title },
    })

    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}

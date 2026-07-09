import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  createAdminGalleryImage,
  parseGalleryImageInput,
} from "@/lib/db/multimedia-admin"
import { requireAnyRole } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

function parseId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new AdminGalleryError("ID de galeria invalido.")
  }
  return id
}

function handleError(error: unknown): Response {
  if (error instanceof AdminGalleryError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json({ error: "Erro ao processar imagem." }, { status: 500 })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const { id: idParam } = await context.params
    const galleryId = parseId(idParam)
    const input = parseGalleryImageInput(await req.json())
    const id = await createAdminGalleryImage(galleryId, input)

    // Log the gallery image creation
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "add_gallery_image",
      targetType: "gallery",
      targetId: idParam,
      metadataJson: { imageId: id, imageUrl: input.imageUrl },
    })

    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}

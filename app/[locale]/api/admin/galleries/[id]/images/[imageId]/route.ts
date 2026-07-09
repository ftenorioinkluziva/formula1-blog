import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  deleteAdminGalleryImage,
  parseGalleryImageInput,
  updateAdminGalleryImage,
} from "@/lib/db/multimedia-admin"
import { requireAnyRole } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

function parseId(value: string, label: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new AdminGalleryError(`${label} invalido.`)
  }
  return id
}

function handleError(error: unknown): Response {
  if (error instanceof AdminGalleryError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json({ error: "Erro ao processar imagem." }, { status: 500 })
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> },
): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const { id: idParam, imageId: imageIdParam } = await context.params
    const galleryId = parseId(idParam, "ID de galeria")
    const imageId = parseId(imageIdParam, "ID de imagem")
    const input = parseGalleryImageInput(await req.json())
    await updateAdminGalleryImage(galleryId, imageId, input)

    // Log the gallery image update
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "update_gallery_image",
      targetType: "gallery",
      targetId: idParam,
      metadataJson: { imageId, imageUrl: input.imageUrl },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> },
): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const { id: idParam, imageId: imageIdParam } = await context.params
    const galleryId = parseId(idParam, "ID de galeria")
    const imageId = parseId(imageIdParam, "ID de imagem")
    await deleteAdminGalleryImage(galleryId, imageId)

    // Log the gallery image deletion
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "delete_gallery_image",
      targetType: "gallery",
      targetId: idParam,
      metadataJson: { imageId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  createAdminGalleryImage,
  parseGalleryImageInput,
} from "@/lib/db/multimedia-admin"

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
  try {
    const { id: idParam } = await context.params
    const galleryId = parseId(idParam)
    const input = parseGalleryImageInput(await req.json())
    const id = await createAdminGalleryImage(galleryId, input)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}

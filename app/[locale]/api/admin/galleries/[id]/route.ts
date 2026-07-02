import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  deleteAdminGallery,
  getAdminGallery,
  parseGalleryInput,
  updateAdminGallery,
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

  return NextResponse.json({ error: "Erro ao processar galeria." }, { status: 500 })
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: idParam } = await context.params
    const id = parseId(idParam)
    const payload = await getAdminGallery(id)

    if (!payload) {
      return NextResponse.json({ error: "Galeria nao encontrada." }, { status: 404 })
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: idParam } = await context.params
    const id = parseId(idParam)
    const input = parseGalleryInput(await req.json())
    await updateAdminGallery(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: idParam } = await context.params
    const id = parseId(idParam)
    await deleteAdminGallery(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

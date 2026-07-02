import { NextRequest, NextResponse } from "next/server"
import {
  AdminGalleryError,
  createAdminGallery,
  listAdminGalleries,
  parseGalleryInput,
} from "@/lib/db/multimedia-admin"

export const dynamic = "force-dynamic"

function handleError(error: unknown): Response {
  if (error instanceof AdminGalleryError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json({ error: "Erro ao processar galeria." }, { status: 500 })
}

export async function GET(): Promise<Response> {
  try {
    const galleries = await listAdminGalleries()
    return NextResponse.json({ galleries }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const input = parseGalleryInput(await req.json())
    const id = await createAdminGallery(input)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}

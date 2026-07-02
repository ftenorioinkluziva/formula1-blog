import { NextResponse } from "next/server"
import { getGalleryImages } from "@/lib/db/multimedia"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const galleryId = Number(id)

  if (!Number.isInteger(galleryId) || galleryId <= 0) {
    return NextResponse.json({ images: [] }, { status: 400 })
  }

  const images = await getGalleryImages(galleryId)
  return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } })
}

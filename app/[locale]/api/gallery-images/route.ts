import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { galleryImages, mediaGalleries } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const db = getDb()
  if (!db) return NextResponse.json({ images: [] })

  const rows = await db
    .select({
      id: galleryImages.id,
      imageUrl: galleryImages.imageUrl,
      caption: galleryImages.caption,
      galleryTitle: mediaGalleries.title,
    })
    .from(galleryImages)
    .innerJoin(mediaGalleries, eq(galleryImages.galleryId, mediaGalleries.id))
    .orderBy(asc(mediaGalleries.sortOrder), asc(galleryImages.sortOrder), asc(galleryImages.id))

  return NextResponse.json({ images: rows }, { headers: { "Cache-Control": "no-store" } })
}

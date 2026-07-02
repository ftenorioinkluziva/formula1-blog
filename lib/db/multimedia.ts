import { asc, count, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { galleryImages, mediaGalleries, mediaPodcasts } from "@/lib/db/schema"

export interface MultimediaVideoItem {
  id: number
  title: string
  duration: string
  views: string
  category: string
  videoUrl: string | null
  thumbnailUrl: string | null
}

export interface MultimediaGalleryItem {
  id: number
  title: string
  count: number
  category: string
  coverImageUrl: string | null
}

export interface GalleryImageItem {
  id: number
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export interface MultimediaPodcastItem {
  id: number
  title: string
  episode: string
  duration: string
  guest: string
  description: string | null
  audioUrl: string | null
  publishedAt: Date | null
  language: string
}

export interface NewPodcastData {
  title: string
  episode: string
  duration: string
  guest: string
  description?: string
  audioUrl?: string
  raceWeekendId?: number
  publishedAt?: Date
  scriptText?: string
  language?: string
  sortOrder?: number
}

export interface MultimediaContent {
  videos: MultimediaVideoItem[]
  galleries: MultimediaGalleryItem[]
  podcasts: MultimediaPodcastItem[]
}

export async function getGalleryImages(galleryId: number): Promise<GalleryImageItem[]> {
  const db = getDb()

  if (!db) return []

  const rows = await db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.galleryId, galleryId))
    .orderBy(asc(galleryImages.sortOrder), asc(galleryImages.id))

  return rows.map((row) => ({
    id: row.id,
    imageUrl: row.imageUrl,
    caption: row.caption ?? null,
    sortOrder: row.sortOrder,
  }))
}

export async function getMultimediaContent(): Promise<MultimediaContent> {
  const db = getDb()

  if (!db) {
    return {
      videos: [],
      galleries: [],
      podcasts: [],
    }
  }

  const [galleryRows, podcastRows] = await Promise.all([
    db.select().from(mediaGalleries).orderBy(desc(mediaGalleries.sortOrder), asc(mediaGalleries.id)),
    db.select().from(mediaPodcasts).orderBy(asc(mediaPodcasts.sortOrder), asc(mediaPodcasts.id)),
  ])

  return {
    videos: [],
    galleries: galleryRows.map((row) => ({
      id: row.id,
      title: row.title,
      count: row.imageCount,
      category: row.category,
      coverImageUrl: row.coverImageUrl ?? null,
    })),
    podcasts: podcastRows.map((row) => ({
      id: row.id,
      title: row.title,
      episode: row.episode,
      duration: row.duration,
      guest: row.guest,
      description: row.description ?? null,
      audioUrl: row.audioUrl ?? null,
      publishedAt: row.publishedAt ?? null,
      language: row.language,
    })),
  }
}

export async function findExistingPodcast(raceWeekendId: number): Promise<{ id: number; audioUrl: string | null; title: string } | null> {
  const db = getDb()
  if (!db) return null

  const [row] = await db
    .select({ id: mediaPodcasts.id, audioUrl: mediaPodcasts.audioUrl, title: mediaPodcasts.title })
    .from(mediaPodcasts)
    .where(eq(mediaPodcasts.raceWeekendId, raceWeekendId))
    .limit(1)

  return row ?? null
}

export async function savePodcast(data: NewPodcastData): Promise<number> {
  const db = getDb()
  if (!db) throw new Error("Database not available")

  const [countRow] = await db.select({ value: count() }).from(mediaPodcasts)
  const nextEpisodeNumber = (countRow?.value ?? 0) + 1
  const episode = data.episode ?? `EP ${String(nextEpisodeNumber).padStart(3, "0")}`

  const [inserted] = await db
    .insert(mediaPodcasts)
    .values({
      title: data.title,
      episode,
      duration: data.duration,
      guest: data.guest,
      description: data.description ?? null,
      audioUrl: data.audioUrl ?? null,
      raceWeekendId: data.raceWeekendId ?? null,
      publishedAt: data.publishedAt ?? null,
      scriptText: data.scriptText ?? null,
      language: data.language ?? "pt",
      sortOrder: data.sortOrder ?? nextEpisodeNumber,
    })
    .returning({ id: mediaPodcasts.id })

  return inserted.id
}

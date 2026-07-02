import { and, asc, count, eq, ne, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { galleryImages, mediaGalleries } from "@/lib/db/schema"

export interface AdminGalleryInput {
  title: string
  category: string
  coverImageUrl?: string | null
  folderKey?: string | null
  sortOrder?: number
}

export interface AdminGalleryImageInput {
  imageUrl: string
  caption?: string | null
  sortOrder?: number
}

export interface AdminGalleryListItem {
  id: number
  title: string
  category: string
  coverImageUrl: string | null
  folderKey: string | null
  sortOrder: number
  imageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface AdminGalleryImageItem {
  id: number
  galleryId: number
  imageUrl: string
  caption: string | null
  sortOrder: number
  createdAt: Date
}

export class AdminGalleryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

function requireDb() {
  const db = getDb()
  if (!db) {
    throw new AdminGalleryError("DB nao disponivel.", 500)
  }
  return db
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function cleanOptionalText(value: unknown): string | null {
  const text = cleanText(value)
  return text.length > 0 ? text : null
}

function cleanSortOrder(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0
  const numeric = Number(value)
  if (!Number.isInteger(numeric)) {
    throw new AdminGalleryError("sortOrder deve ser um numero inteiro.")
  }
  return numeric
}

export function validateImageUrl(value: unknown, fieldName = "imageUrl"): string | null {
  const url = cleanOptionalText(value)
  if (!url) return null

  const isCloudinary = url.startsWith("https://res.cloudinary.com/")
  const isInternalPath = url.startsWith("/") && !url.startsWith("//")

  if (!isCloudinary && !isInternalPath) {
    throw new AdminGalleryError(`${fieldName} deve ser uma URL Cloudinary ou um caminho interno.`)
  }

  return url
}

export function parseGalleryInput(data: unknown): AdminGalleryInput {
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const title = cleanText(source.title)
  const category = cleanText(source.category)

  if (!title) throw new AdminGalleryError("Titulo e obrigatorio.")
  if (!category) throw new AdminGalleryError("Categoria e obrigatoria.")

  return {
    title,
    category,
    coverImageUrl: validateImageUrl(source.coverImageUrl, "coverImageUrl"),
    folderKey: cleanOptionalText(source.folderKey),
    sortOrder: cleanSortOrder(source.sortOrder),
  }
}

export function parseGalleryImageInput(data: unknown): AdminGalleryImageInput {
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const imageUrl = validateImageUrl(source.imageUrl)

  if (!imageUrl) throw new AdminGalleryError("URL da imagem e obrigatoria.")

  return {
    imageUrl,
    caption: cleanOptionalText(source.caption),
    sortOrder: cleanSortOrder(source.sortOrder),
  }
}

async function ensureUniqueFolderKey(folderKey: string | null | undefined, currentGalleryId?: number): Promise<void> {
  if (!folderKey) return

  const db = requireDb()
  const where = currentGalleryId
    ? and(eq(mediaGalleries.folderKey, folderKey), ne(mediaGalleries.id, currentGalleryId))
    : eq(mediaGalleries.folderKey, folderKey)

  const [existing] = await db.select({ id: mediaGalleries.id }).from(mediaGalleries).where(where).limit(1)
  if (existing) {
    throw new AdminGalleryError("folderKey ja esta em uso.", 409)
  }
}

export async function listAdminGalleries(): Promise<AdminGalleryListItem[]> {
  const db = requireDb()

  const rows = await db
    .select({
      id: mediaGalleries.id,
      title: mediaGalleries.title,
      category: mediaGalleries.category,
      coverImageUrl: mediaGalleries.coverImageUrl,
      folderKey: mediaGalleries.folderKey,
      sortOrder: mediaGalleries.sortOrder,
      imageCount: sql<number>`cast(count(${galleryImages.id}) as int)`,
      createdAt: mediaGalleries.createdAt,
      updatedAt: mediaGalleries.updatedAt,
    })
    .from(mediaGalleries)
    .leftJoin(galleryImages, eq(galleryImages.galleryId, mediaGalleries.id))
    .groupBy(mediaGalleries.id)
    .orderBy(asc(mediaGalleries.sortOrder), asc(mediaGalleries.id))

  return rows
}

export async function getAdminGallery(id: number): Promise<{ gallery: AdminGalleryListItem; images: AdminGalleryImageItem[] } | null> {
  const db = requireDb()
  const gallery = (await listAdminGalleries()).find((item) => item.id === id)
  if (!gallery) return null

  const images = await db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.galleryId, id))
    .orderBy(asc(galleryImages.sortOrder), asc(galleryImages.id))

  return { gallery, images }
}

export async function createAdminGallery(input: AdminGalleryInput): Promise<number> {
  await ensureUniqueFolderKey(input.folderKey)
  const db = requireDb()

  const [inserted] = await db
    .insert(mediaGalleries)
    .values({
      title: input.title,
      category: input.category,
      coverImageUrl: input.coverImageUrl ?? null,
      folderKey: input.folderKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      imageCount: 0,
    })
    .returning({ id: mediaGalleries.id })

  return inserted.id
}

export async function updateAdminGallery(id: number, input: AdminGalleryInput): Promise<void> {
  await ensureUniqueFolderKey(input.folderKey, id)
  const db = requireDb()

  await db
    .update(mediaGalleries)
    .set({
      title: input.title,
      category: input.category,
      coverImageUrl: input.coverImageUrl ?? null,
      folderKey: input.folderKey ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(eq(mediaGalleries.id, id))
}

export async function deleteAdminGallery(id: number): Promise<void> {
  const db = requireDb()
  await db.delete(mediaGalleries).where(eq(mediaGalleries.id, id))
}

export async function refreshGalleryImageCount(galleryId: number): Promise<number> {
  const db = requireDb()
  const [row] = await db.select({ value: count() }).from(galleryImages).where(eq(galleryImages.galleryId, galleryId))
  const value = row?.value ?? 0

  await db.update(mediaGalleries).set({ imageCount: value }).where(eq(mediaGalleries.id, galleryId))
  return value
}

export async function createAdminGalleryImage(galleryId: number, input: AdminGalleryImageInput): Promise<number> {
  const db = requireDb()
  const [gallery] = await db.select({ id: mediaGalleries.id }).from(mediaGalleries).where(eq(mediaGalleries.id, galleryId)).limit(1)
  if (!gallery) throw new AdminGalleryError("Galeria nao encontrada.", 404)

  const [inserted] = await db
    .insert(galleryImages)
    .values({
      galleryId,
      imageUrl: input.imageUrl,
      caption: input.caption ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: galleryImages.id })

  await refreshGalleryImageCount(galleryId)
  return inserted.id
}

export async function updateAdminGalleryImage(galleryId: number, imageId: number, input: AdminGalleryImageInput): Promise<void> {
  const db = requireDb()
  await db
    .update(galleryImages)
    .set({
      imageUrl: input.imageUrl,
      caption: input.caption ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(galleryImages.id, imageId), eq(galleryImages.galleryId, galleryId)))
}

export async function deleteAdminGalleryImage(galleryId: number, imageId: number): Promise<void> {
  const db = requireDb()
  await db.delete(galleryImages).where(and(eq(galleryImages.id, imageId), eq(galleryImages.galleryId, galleryId)))
  await refreshGalleryImageCount(galleryId)
}

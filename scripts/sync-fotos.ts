import fs from "node:fs"
import path from "node:path"
import { v2 as cloudinary } from "cloudinary"
import { asc, desc, eq } from "drizzle-orm"
import { config as loadEnv } from "dotenv"

import { getDb } from "../lib/db/client"
import { galleryImages, mediaGalleries } from "../lib/db/schema"

loadEnv({ path: ".env.local" })
loadEnv()

const FOTOS_ROOT = path.join(process.cwd(), "f1_2026_fotos")
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"])
const UPLOAD_MAX_RETRIES = 4
const UPLOAD_BACKOFF_SECONDS = 2

function slugify(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function titleize(texto: string): string {
  return texto
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function assertEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} não definido.`)
  }
  return value
}

function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: assertEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: assertEnv("CLOUDINARY_API_KEY"),
    api_secret: assertEnv("CLOUDINARY_API_SECRET"),
  })
}

function deriveCloudinaryUrl(publicId: string, resourceType: "image" | "raw" | "video"): string {
  const cloudName = assertEnv("CLOUDINARY_CLOUD_NAME")
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`
}

function isAlreadyUploaded(error: unknown): boolean {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: string }).message).toLowerCase().includes("already exists")
      || String((error as { message: string }).message).toLowerCase().includes("already been")
    : String(error).toLowerCase().includes("already exists") || String(error).toLowerCase().includes("already been")
}

async function uploadImage(filePath: string, publicId: string, force = false): Promise<string | null> {
  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        resource_type: "image",
        overwrite: force,
        unique_filename: false,
      })
      return result.secure_url
    } catch (error) {
      if (isAlreadyUploaded(error)) {
        return deriveCloudinaryUrl(publicId, "image")
      }

      if (attempt < UPLOAD_MAX_RETRIES) {
        const waitMs = UPLOAD_BACKOFF_SECONDS ** (attempt - 1) * 1000
        console.warn(`    [aviso] falha no upload (${attempt}/${UPLOAD_MAX_RETRIES}): ${String(error)}`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }

      console.error(`    [erro] upload falhou: ${String(error)}`)
      return null
    }
  }

  return null
}

async function ensureDatabase() {
  const db = getDb()
  if (!db) {
    throw new Error("DATABASE_URL não definido ou banco indisponível.")
  }
  return db
}

async function syncGallery(
  sourceDir: string,
  galleryDir: string,
  force: boolean,
): Promise<{ synced: boolean; uploadedCount: number }> {
  const db = await ensureDatabase()
  const sourceName = path.basename(sourceDir)
  const galleryName = path.basename(galleryDir)
  const folderKey = `${sourceName}/${galleryName}`
  const titleFile = path.join(galleryDir, "_titulo.txt")

  const imageFiles = fs
    .readdirSync(galleryDir)
    .filter((file) => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  if (imageFiles.length === 0) {
    return { synced: false, uploadedCount: 0 }
  }

  const existingRows = await db
    .select({
      id: mediaGalleries.id,
      sortOrder: mediaGalleries.sortOrder,
    })
    .from(mediaGalleries)
    .where(eq(mediaGalleries.folderKey, folderKey))
    .limit(1)

  const existing = existingRows[0] ?? null
  let title = fs.existsSync(titleFile)
    ? fs.readFileSync(titleFile, "utf-8").trim()
    : titleize(galleryName)
  if (!title) {
    title = titleize(galleryName)
  }

  const uploaded: Array<{ url: string; caption: string }> = []
  for (const fileName of imageFiles) {
    const filePath = path.join(galleryDir, fileName)
    const publicId = `f1blog/galleries/${slugify(sourceName)}/${slugify(galleryName)}/${slugify(path.parse(fileName).name)}`
    const url = await uploadImage(filePath, publicId, force)
    if (!url) {
      continue
    }
    uploaded.push({
      url,
      caption: titleize(path.parse(fileName).name),
    })
  }

  if (uploaded.length === 0) {
    return { synced: false, uploadedCount: 0 }
  }

  const coverImageUrl = uploaded[0]?.url ?? null
  const nextSortOrderRows = await db
    .select({ sortOrder: mediaGalleries.sortOrder })
    .from(mediaGalleries)
    .orderBy(desc(mediaGalleries.sortOrder), asc(mediaGalleries.id))
    .limit(1)
  const nextSortOrder = (nextSortOrderRows[0]?.sortOrder ?? -1) + 1

  await db.transaction(async (tx) => {
    let galleryId = existing?.id ?? null

    if (galleryId) {
      await tx
        .update(mediaGalleries)
        .set({
          title,
          imageCount: uploaded.length,
          category: "PHOTOS",
          coverImageUrl,
        })
        .where(eq(mediaGalleries.id, galleryId))
      await tx.delete(galleryImages).where(eq(galleryImages.galleryId, galleryId))
    } else {
      const inserted = await tx
        .insert(mediaGalleries)
        .values({
          title,
          imageCount: uploaded.length,
          category: "PHOTOS",
          coverImageUrl,
          folderKey,
          sortOrder: nextSortOrder,
        })
        .returning({ id: mediaGalleries.id })

      galleryId = inserted[0]?.id ?? null
    }

    if (!galleryId) {
      throw new Error(`Falha ao preparar galeria ${folderKey}`)
    }

    for (let index = 0; index < uploaded.length; index += 1) {
      const image = uploaded[index]
      await tx.insert(galleryImages).values({
        galleryId,
        imageUrl: image.url,
        caption: image.caption,
        sortOrder: index,
      })
    }
  })

  return { synced: true, uploadedCount: uploaded.length }
}

async function cleanupGallery(sourceDir: string, galleryDir: string): Promise<void> {
  fs.rmSync(galleryDir, { recursive: true, force: true })

  const sourceEntries = fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : []
  if (sourceEntries.length === 0) {
    fs.rmSync(sourceDir, { recursive: true, force: true })
  }
}

async function run(): Promise<void> {
  if (!fs.existsSync(FOTOS_ROOT)) {
    console.log(`Pasta não encontrada: ${FOTOS_ROOT}`)
    return
  }

  configureCloudinary()

  const args = new Set(process.argv.slice(2))
  const force = args.has("--force")
  const cleanup = args.has("--cleanup")

  const sourceDirs = fs
    .readdirSync(FOTOS_ROOT)
    .map((entry) => path.join(FOTOS_ROOT, entry))
    .filter((entry) => fs.statSync(entry).isDirectory())
    .sort((a, b) => a.localeCompare(b))

  if (sourceDirs.length === 0) {
    console.log(`Nenhuma pasta encontrada em ${FOTOS_ROOT}`)
    return
  }

  console.log("\n=== Sincronizando fotos F1 ===\n")

  let syncedCount = 0
  let uploadedCount = 0

  for (const sourceDir of sourceDirs) {
    const galleryDirs = fs
      .readdirSync(sourceDir)
      .map((entry) => path.join(sourceDir, entry))
      .filter((entry) => fs.statSync(entry).isDirectory())
      .sort((a, b) => a.localeCompare(b))

    for (const galleryDir of galleryDirs) {
      const result = await syncGallery(sourceDir, galleryDir, force)
      if (!result.synced) {
        continue
      }
      syncedCount += 1
      uploadedCount += result.uploadedCount
      console.log(`  [ok] ${path.basename(sourceDir)}/${path.basename(galleryDir)} — ${result.uploadedCount} foto(s)`)

      if (cleanup) {
        await cleanupGallery(sourceDir, galleryDir)
        console.log(`      removida pasta local: ${galleryDir}`)
      }
    }
  }

  console.log("\n=== Relatório final ===")
  console.log(`  Galerias sincronizadas: ${syncedCount}`)
  console.log(`  Imagens enviadas:       ${uploadedCount}`)
}

run().catch((error) => {
  console.error("\n[erro] Falha no sync de fotos:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})

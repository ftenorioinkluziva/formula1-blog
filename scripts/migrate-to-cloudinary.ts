import fs from "fs"
import path from "path"
import { v2 as cloudinary } from "cloudinary"
import { Client } from "pg"
import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const PUBLIC_DIR = path.join(process.cwd(), "public")
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? ""

function cloudinaryUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`
}

function isAlreadyMigrated(url: string): boolean {
  return url?.startsWith("https://res.cloudinary.com/") ?? false
}

function localPathFromUrl(localUrl: string): string {
  return path.join(PUBLIC_DIR, localUrl.replace(/^\//, ""))
}

function publicIdFromLocalUrl(localUrl: string, resourceType: "image" | "video"): string {
  // /images/galleries/bahrain/day2/file.jpg → f1blog/galleries/bahrain/day2/file
  // /videos/ferrari_test/video.mp4 → f1blog/videos/ferrari_test/video
  const withoutLeadingSlash = localUrl.replace(/^\//, "")
  const withoutPublicPrefix = withoutLeadingSlash.replace(/^(images|videos)\//, "")
  const withoutExt = withoutPublicPrefix.replace(/\.[^/.]+$/, "")
  return `f1blog/${withoutExt}`
}

type UploadResult = { ok: true; publicId: string; url: string } | { ok: false; error: unknown }

// Accepts either (localUrl, resourceType) for image-based assets resolved from their URL,
// or (filePath, resourceType, publicId) for assets resolved from disk directly.
async function uploadFile(
  filePathOrUrl: string,
  resourceType: "image",
  explicitPublicId?: string,
): Promise<UploadResult> {
  const filePath = explicitPublicId ? filePathOrUrl : localPathFromUrl(filePathOrUrl)

  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${filePath}` }
  }

  const publicId = explicitPublicId ?? publicIdFromLocalUrl(filePathOrUrl, resourceType)

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      resource_type: resourceType,
      overwrite: false,
      unique_filename: false,
    })

    return { ok: true, publicId, url: result.secure_url }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("already exists") || msg.includes("overwrite")) {
      return { ok: true, publicId, url: cloudinaryUrl(publicId) }
    }
    return { ok: false, error: err }
  }
}

async function run() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("DATABASE_URL não definido.")
    process.exit(1)
  }

  if (!process.env.CLOUDINARY_API_SECRET) {
    console.error("CLOUDINARY_API_SECRET não definido em .env.local.")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  await client.connect()

  const stats = { images: 0, skipped: 0, errors: 0 }
  const errors: string[] = []

  console.log("\n=== Migração para Cloudinary ===\n")

  try {
    // --- gallery_images ---
    console.log("📷 Migrando imagens de galerias...")

    const galleryImages = await client.query<{ id: number; image_url: string; gallery_id: number }>(
      "SELECT id, image_url, gallery_id FROM gallery_images ORDER BY gallery_id, sort_order",
    )

    for (const row of galleryImages.rows) {
      if (isAlreadyMigrated(row.image_url)) {
        stats.skipped++
        continue
      }

      const result = await uploadFile(row.image_url, "image")

      if (!result.ok) {
        console.log(`  ✗ ${row.image_url} — ${result.error}`)
        errors.push(`gallery_images id=${row.id}: ${result.error}`)
        stats.errors++
        continue
      }

      await client.query("UPDATE gallery_images SET image_url = $1 WHERE id = $2", [result.url, row.id])
      console.log(`  ✓ ${row.image_url}`)
      stats.images++
    }

    // --- media_galleries cover_image_url ---
    console.log("\n🖼️  Migrando covers de galerias...")

    const galleriesCovers = await client.query<{ id: number; cover_image_url: string }>(
      "SELECT id, cover_image_url FROM media_galleries WHERE cover_image_url IS NOT NULL",
    )

    for (const row of galleriesCovers.rows) {
      if (isAlreadyMigrated(row.cover_image_url)) {
        stats.skipped++
        continue
      }

      const result = await uploadFile(row.cover_image_url, "image")

      if (!result.ok) {
        console.log(`  ✗ ${row.cover_image_url} — ${result.error}`)
        errors.push(`media_galleries id=${row.id} cover: ${result.error}`)
        stats.errors++
        continue
      }

      await client.query("UPDATE media_galleries SET cover_image_url = $1 WHERE id = $2", [result.url, row.id])
      console.log(`  ✓ ${row.cover_image_url}`)
      stats.images++
    }

  } finally {
    await client.end()
  }

  console.log("\n=== Relatório Final ===")
  console.log(`  Imagens migradas:    ${stats.images}`)
  console.log(`  Já migrados (skip):  ${stats.skipped}`)
  console.log(`  Erros:               ${stats.errors}`)

  if (errors.length > 0) {
    console.log("\nErros detalhados:")
    for (const e of errors) {
      console.log(`  - ${e}`)
    }
    process.exitCode = 1
  } else {
    console.log("\nMigração concluída sem erros.")
  }
}

run()

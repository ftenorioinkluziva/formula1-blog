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

const VIDEOS_ROOT = path.join(process.cwd(), "public", "videos")
const POLE_FILE_REGEX = /^pole_(\d{2})\.mp4$/i
const CLOUDINARY_FOLDER = "f1blog/pole-laps"
const FIXED_SEASON = 2026

function parseRound(filename: string): number | null {
  const match = filename.match(POLE_FILE_REGEX)
  return match ? parseInt(match[1], 10) : null
}

async function uploadPoleVideo(filePath: string, round: number): Promise<string> {
  const publicId = `${CLOUDINARY_FOLDER}/pole_${String(round).padStart(2, "0")}`
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      resource_type: "video",
      overwrite: false,
      unique_filename: false,
    })
    return result.secure_url
  } catch {
    // Asset already exists — derive URL from public_id
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}`
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido.")
    process.exit(1)
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    console.error("CLOUDINARY_API_SECRET não definido em .env.local.")
    process.exit(1)
  }

  if (!fs.existsSync(VIDEOS_ROOT)) {
    console.error(`Pasta ${VIDEOS_ROOT} não encontrada.`)
    process.exit(1)
  }

  const poleFiles = fs.readdirSync(VIDEOS_ROOT).filter((f) => POLE_FILE_REGEX.test(f))

  if (poleFiles.length === 0) {
    console.log("Nenhum arquivo pole_NN.mp4 encontrado em public/videos/")
    return
  }

  console.log(`\nEncontrados ${poleFiles.length} vídeo(s) de pole: ${poleFiles.join(", ")}\n`)

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    await client.query("BEGIN")

    for (const file of poleFiles) {
      const round = parseRound(file)
      if (!round) continue

      const filePath = path.join(VIDEOS_ROOT, file)
      process.stdout.write(`  Uploading round ${round} (${file})...`)

      const url = await uploadPoleVideo(filePath, round)

      await client.query(
        `INSERT INTO pole_videos (season, round, cloudinary_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (season, round) DO UPDATE SET cloudinary_url = EXCLUDED.cloudinary_url`,
        [FIXED_SEASON, round, url],
      )

      console.log(` ✓\n    ${url}`)
    }

    await client.query("COMMIT")
    console.log(`\nSync concluído: ${poleFiles.length} vídeo(s).`)
    console.log("Pode apagar os arquivos de public/videos/ após confirmar o upload.")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Erro no sync:", error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()

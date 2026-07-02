import { v2 as cloudinary } from "cloudinary"
import {
  getLastCompletedRace,
  getRaceDataForScript,
  generatePodcastScript,
  estimateDuration,
} from "@/lib/podcast/script-generator"
import { convertScriptToAudio } from "@/lib/podcast/tts"
import { savePodcast, findExistingPodcast } from "@/lib/db/multimedia"

export interface GeneratePodcastOptions {
  season?: number
  round?: number
}

export interface GeneratePodcastResult {
  podcastId: number
  audioUrl: string
  title: string
  duration: string
}

export async function generatePodcastForRace(options: GeneratePodcastOptions = {}): Promise<GeneratePodcastResult> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const weekendInfo = await getLastCompletedRace(options.season, options.round)
  if (!weekendInfo) throw new Error("Nenhum Grande Prêmio finalizado encontrado")

  const existing = await findExistingPodcast(weekendInfo.weekendId)
  if (existing) {
    console.log(`⏭️  Podcast já existe para este GP (ID: ${existing.id}). Pulando geração.`)
    return {
      podcastId: existing.id,
      audioUrl: existing.audioUrl ?? "",
      title: existing.title,
      duration: "",
    }
  }

  const raceData = await getRaceDataForScript(weekendInfo)
  if (!raceData) throw new Error(`Dados da corrida não encontrados para o GP ${weekendInfo.grandPrixName}`)

  const script = await generatePodcastScript(raceData)
  if (!script) throw new Error("Falha ao gerar script do podcast")

  const audioBuffer = await convertScriptToAudio(script)
  const fsPromisesModule = "fs/promises"
  const pathModule = "path"
  const osModule = "os"
  const [{ writeFile, unlink }, { join }, { tmpdir }] = await Promise.all([
    import(fsPromisesModule) as Promise<typeof import("fs/promises")>,
    import(pathModule) as Promise<typeof import("path")>,
    import(osModule) as Promise<typeof import("os")>,
  ])

  const tmpPath = join(tmpdir(), `podcast_s${raceData.season}_r${raceData.round}.mp3`)
  await writeFile(tmpPath, audioBuffer)

  let audioUrl: string
  try {
    const publicId = `f1blog/podcasts/ep_${raceData.season}_r${String(raceData.round).padStart(2, "0")}`
    const uploadResult = await cloudinary.uploader.upload(tmpPath, {
      resource_type: "video",
      public_id: publicId,
      overwrite: false,
    })
    audioUrl = uploadResult.secure_url
  } finally {
    await unlink(tmpPath).catch(() => undefined)
  }

  const duration = estimateDuration(script)
  const title = `GP ${weekendInfo.grandPrixName} ${weekendInfo.season} — Análise Completa`
  const description = `Análise completa do ${weekendInfo.grandPrixName} ${weekendInfo.season}. Resultados, estratégias e impacto no campeonato.`

  const winner = raceData.results[0]?.driverName ?? "F1 Insight"

  const podcastId = await savePodcast({
    title,
    episode: "",
    duration,
    guest: winner,
    description,
    audioUrl,
    raceWeekendId: raceData.weekendId,
    publishedAt: new Date(),
    scriptText: script,
    language: "pt",
  })

  return { podcastId, audioUrl, title, duration }
}

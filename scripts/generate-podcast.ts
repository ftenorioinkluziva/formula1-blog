import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { generatePodcastForRace } from "../lib/podcast/pipeline"

const seasonArg = process.argv[2] ? parseInt(process.argv[2], 10) : undefined
const roundArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined

async function main() {
  const seasonLabel = seasonArg ? `temporada ${seasonArg}` : "última temporada ativa"
  const roundLabel = roundArg ? `, round ${roundArg}` : ""
  console.log(`\n🎙️  Gerando podcast F1 Insight (${seasonLabel}${roundLabel})...\n`)

  try {
    const result = await generatePodcastForRace({ season: seasonArg, round: roundArg })

    console.log("✅ Podcast gerado com sucesso!")
    console.log(`   ID:       ${result.podcastId}`)
    console.log(`   Título:   ${result.title}`)
    console.log(`   Duração:  ${result.duration}`)
    console.log(`   Áudio:    ${result.audioUrl}`)
  } catch (error) {
    console.error("❌ Erro ao gerar podcast:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()

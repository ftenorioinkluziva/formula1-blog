import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { evolveFantasyPrices } from "../lib/db/fantasy-pricing"

const season = parseInt(process.argv[2] ?? "2026", 10)
const fromRound = parseInt(process.argv[3] ?? "", 10)
const toRound = parseInt(process.argv[4] ?? "", 10)

if (!fromRound || !toRound || toRound <= fromRound) {
  console.error("Usage: pnpm db:evolve-prices <season> <fromRound> <toRound>")
  console.error("Example: pnpm db:evolve-prices 2026 1 2")
  process.exit(1)
}

async function main() {
  console.log(`\nEvolving fantasy prices: season ${season}, round ${fromRound} → ${toRound}\n`)

  const result = await evolveFantasyPrices(season, fromRound, toRound)

  if (!result) {
    console.error("Failed to evolve prices — no assets found or DB unavailable.")
    process.exit(1)
  }

  const drivers = result.updatedAssets.filter((a) => a.assetType === "driver")
  const teamAssets = result.updatedAssets.filter((a) => a.assetType === "team")
  const engineers = result.updatedAssets.filter((a) => a.assetType === "engineer")

  const printGroup = (label: string, items: typeof result.updatedAssets) => {
    console.log(`\n  ${label}:`)
    for (const item of items.sort((a, b) => b.delta - a.delta)) {
      const arrow = item.delta > 0 ? "▲" : item.delta < 0 ? "▼" : "="
      const deltaStr = item.delta > 0 ? `+${item.delta}` : `${item.delta}`
      console.log(`    ${arrow} ${item.name.padEnd(28)} ${item.oldPrice.toFixed(1)} → ${item.newPrice.toFixed(1)}  (${deltaStr})  PI=${item.performanceIndex}`)
    }
  }

  printGroup("Drivers", drivers)
  printGroup("Teams", teamAssets)
  printGroup("Engineers", engineers)

  const totalMoved = result.updatedAssets.filter((a) => a.delta !== 0).length
  console.log(`\n${result.updatedAssets.length} assets processed, ${totalMoved} prices changed.\n`)
}

main().catch((error) => {
  console.error("Failed to evolve prices:", error)
  process.exit(1)
})

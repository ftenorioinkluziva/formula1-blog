import { Client } from "pg"
import { createClient } from "redis"
import { config as loadEnv } from "dotenv"
import {
  clearSeedTables,
  seedDrivers,
  seedMedia,
  seedNews,
  seedRaceSessions,
  seedTeams,
} from "./seed-data/seed-domains"

loadEnv({ path: ".env.local" })
loadEnv()

const season = 2026

const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

async function invalidateSessionBannerCache() {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    return
  }

  const redis = createClient({ url: redisUrl })

  try {
    await redis.connect()
    await redis.del("session-banner:v1")
  } catch (error) {
    console.warn("Falha ao invalidar cache Redis do session banner:", error)
  } finally {
    if (redis.isOpen) {
      await redis.quit()
    }
  }
}

async function run() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error("DATABASE_URL não definido.")
    process.exit(1)
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query("BEGIN")
    await clearSeedTables(client, season)
    await seedTeams(client)
    await seedMedia(client)
    await seedNews(client)
    const driverByCode = await seedDrivers(client)
    const inserted = await seedRaceSessions(client, { season, pointsTable, driverByCode })

    await client.query("COMMIT")
    await invalidateSessionBannerCache()
    console.log(`Seed de fim de semana concluído: ${inserted} sessões inseridas para ${season}.`)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Erro no seed de weekend sessions:", error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()

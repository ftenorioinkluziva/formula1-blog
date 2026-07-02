import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { config as loadEnv } from "dotenv"
import { Client } from "pg"

loadEnv({ path: ".env.local" })
loadEnv()

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface JournalFile {
  version: string
  dialect: string
  entries: JournalEntry[]
}

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL não definido")
  }

  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json")

  if (!fs.existsSync(journalPath)) {
    throw new Error("Arquivo drizzle/meta/_journal.json não encontrado")
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as JournalFile
  const lastEntry = journal.entries[journal.entries.length - 1]

  if (!lastEntry) {
    throw new Error("Journal sem entries")
  }

  const migrationFilePath = path.join(process.cwd(), "drizzle", `${lastEntry.tag}.sql`)

  if (!fs.existsSync(migrationFilePath)) {
    throw new Error(`Arquivo de migração não encontrado: drizzle/${lastEntry.tag}.sql`)
  }

  const migrationSql = fs.readFileSync(migrationFilePath, "utf8")
  const migrationHash = crypto.createHash("sha256").update(migrationSql).digest("hex")

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle")
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `)

    const latestResult = await client.query<{ created_at: string | number }>(`
      SELECT created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `)

    const latestCreatedAt = latestResult.rows[0]?.created_at ? Number(latestResult.rows[0].created_at) : null

    if (latestCreatedAt !== null && latestCreatedAt >= lastEntry.when) {
      console.log("Baseline já está atualizado.")
      return
    }

    await client.query(
      `
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES ($1, $2)
      `,
      [migrationHash, lastEntry.when],
    )

    console.log(`Baseline aplicado com sucesso: ${lastEntry.tag}`)
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error("Falha ao aplicar baseline do Drizzle:", error)
  process.exit(1)
})

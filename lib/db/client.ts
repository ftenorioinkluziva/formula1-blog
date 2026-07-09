import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "@/lib/db/schema"

type AppDatabase = NodePgDatabase<typeof schema>

declare global {
  var __f1BlogDbPool: Pool | undefined
  var __f1BlogDatabase: AppDatabase | undefined
}

export function getDb(): AppDatabase | null {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    return null
  }

  if (!globalThis.__f1BlogDbPool) {
    globalThis.__f1BlogDbPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000,
    })
  }

  if (!globalThis.__f1BlogDatabase) {
    globalThis.__f1BlogDatabase = drizzle(globalThis.__f1BlogDbPool, { schema })
  }

  return globalThis.__f1BlogDatabase
}

export async function closeDb(): Promise<void> {
  const pool = globalThis.__f1BlogDbPool

  globalThis.__f1BlogDatabase = undefined
  globalThis.__f1BlogDbPool = undefined

  if (pool) {
    await pool.end()
  }
}

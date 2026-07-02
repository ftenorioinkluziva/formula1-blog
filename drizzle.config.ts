import { defineConfig } from "drizzle-kit"
import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
})

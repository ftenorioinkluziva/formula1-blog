import "server-only"

import { setTokenDirectly } from "@/lib/f1tv/auth"
import { saveTokenToRedis } from "@/lib/f1tv/token-store"

export async function tryPersistTokenToEnv(rawCookieValue: string): Promise<boolean> {
  try {
    const fsModName = "node:fs"
    const pathModName = "node:path"
    const { existsSync, readFileSync, writeFileSync } = await import(fsModName)
    const { resolve } = await import(pathModName)

    const envPath = resolve(process.env.PWD ?? ".", ".env.local")
    if (!existsSync(envPath)) return false

    const content = readFileSync(envPath, "utf-8")
    const lines = content.split("\n").filter((line: string) => !line.startsWith("F1TV_TOKEN="))
    lines.push(`F1TV_TOKEN="${rawCookieValue}"`)
    writeFileSync(envPath, lines.join("\n"))
    return true
  } catch {
    return false
  }
}

export async function activateAndPersistToken(rawCookieValue: string): Promise<{
  persistedEnv: boolean
  persistedRedis: boolean
}> {
  setTokenDirectly(rawCookieValue)

  const [persistedEnv, persistedRedis] = await Promise.all([
    tryPersistTokenToEnv(rawCookieValue),
    saveTokenToRedis(rawCookieValue),
  ])

  return { persistedEnv, persistedRedis }
}

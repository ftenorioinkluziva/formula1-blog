import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type SyncedNewsItem = {
  filename: string
  source: string
  title: string
  date: string
  time?: string | null
  url: string
  fetchedAt?: string
  excerpt?: string
  author?: string
  readTime?: string
}

type NewsSyncSnapshot = {
  syncedAt?: string
  items?: SyncedNewsItem[]
}

export async function GET(): Promise<Response> {
  try {
    const file = join(process.cwd(), "data", "news-sync", "latest.json")
    const raw = await readFile(file, "utf8")
    const parsed = JSON.parse(raw) as NewsSyncSnapshot
    return NextResponse.json(
      {
        syncedAt: parsed.syncedAt ?? null,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { syncedAt: null, items: [] },
      { headers: { "Cache-Control": "no-store" } },
    )
  }
}

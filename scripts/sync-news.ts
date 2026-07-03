import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

const OUTPUT_LIMIT = 50
const DELAY_MS = 1500
const MESSAGE_LIMIT = 3900
const SYNC_DIR = join(process.cwd(), "data", "news-sync")
const LATEST_SYNC_FILE = join(SYNC_DIR, "latest.json")
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

const SOURCES = [
  {
    name: "formula1",
    url: "https://www.formula1.com/en/latest",
    list: listFormula1,
    extract: extractFormula1,
  },
  {
    name: "fia",
    url: "https://www.fia.com/news/tags/f1-245",
    list: listFia,
    extract: extractFia,
  },
  {
    name: "lastwordonsports",
    url: "https://lastwordonsports.com/motorsports/category/formula-1/",
    list: listLastWordOnSports,
    extract: extractLastWordOnSports,
  },
] as const

const TITULOS_BLOQUEADOS = [
  "f1 fantasy",
  "fantasy",
  "f1 tv",
  "quiz",
  "crossword",
  "wordle",
  "playlist",
  "wallpaper",
  "watch guide",
  "how to watch",
  "where to watch",
  "tv guide",
  "broadcast guide",
  "beyond the grid",
  "podcast",
  "betting",
  "bettor",
  "bettors",
  "casino",
]

type NewsItem = {
  title: string
  url: string
  date: string
  time?: string | null
}

type SourceDescriptor = (typeof SOURCES)[number]

type ImportedNews = {
  source: string
  title: string
  date: string
  url: string
  filename: string
}

type SyncedNewsItem = ImportedNews & {
  fetchedAt: string
  time: string | null
  excerpt: string
  author: string
  readTime: string
  body: string[]
}

type NewsSyncSnapshot = {
  syncedAt: string
  items: SyncedNewsItem[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80)
}

function isBlockedTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return TITULOS_BLOQUEADOS.some((term) => lower.includes(term))
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function stripTags(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
}

function absoluteUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  return new URL(href, base).toString()
}

function extractAttr(html: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i")
  return html.match(re)?.[1] ?? null
}

function extractMeta(html: string): string | null {
  const re = /<meta[^>]*property=["'](?:published_time|publish_date)["'][^>]*content=["']([^"']+)["'][^>]*>/i
  return html.match(re)?.[1] ?? null
}


async function fetchHtml(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: HEADERS,
    signal: AbortSignal.timeout(30_000),
    ...init,
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`)
  }
  return await res.text()
}

function extractParagraphs(html: string): string[] {
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  if (paragraphs.length > 0) {
    return paragraphs
  }

  const fallback = stripTags(html)
  return fallback ? [fallback] : []
}

function extractDateFromIso(value: string | null | undefined): { date: string | null; time: string | null } {
  if (!value) {
    return { date: null, time: null }
  }

  const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
  const timeMatch = value.match(/T(\d{2}:\d{2})/)
  return {
    date: dateMatch?.[1] ?? value.slice(0, 10),
    time: timeMatch?.[1] ?? null,
  }
}

function extractJsonLdDate(html: string): { date: string | null; time: string | null } {
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim()) as unknown
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item && typeof item === "object" && "datePublished" in item) {
          const raw = String((item as { datePublished?: string }).datePublished ?? "")
          const { date, time } = extractDateFromIso(raw)
          return { date, time }
        }
      }
    } catch {
      continue
    }
  }
  return { date: null, time: null }
}

function parseFiaDate(text: string): string {
  const match = text.match(/\b(\d{2})\.(\d{2})\.(\d{2})\b/)
  if (!match) return new Date().toISOString().slice(0, 10)
  const [, day, month, year] = match
  return `20${year}-${month}-${day}`
}

function parseFiaNewsLinks(html: string, maxItems = OUTPUT_LIMIT): NewsItem[] {
  const items: NewsItem[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']*\/news\/f1-[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (items.length >= maxItems) break
    const link = match[1]
    const title = stripTags(match[2]).slice(0, 200)
    if (!link || !title || title.length <= 10) continue

    const urlAbs = absoluteUrl("https://www.fia.com", link)
    if (seen.has(urlAbs)) continue
    seen.add(urlAbs)

    const start = Math.max(0, match.index - 500)
    const end = Math.min(html.length, match.index + match[0].length + 500)
    const nearby = html.slice(start, end)
    const date = parseFiaDate(nearby)
    items.push({ title, url: urlAbs, date, time: null })
  }

  return items
}

function estimateReadTime(body: string[]): string {
  const words = body.join(" ").split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 200))} min`
}

async function readLatestSync(): Promise<NewsSyncSnapshot> {
  try {
    const raw = await readFile(LATEST_SYNC_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<NewsSyncSnapshot>
    return {
      syncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : new Date(0).toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    return { syncedAt: new Date(0).toISOString(), items: [] }
  }
}

async function writeLatestSync(snapshot: NewsSyncSnapshot): Promise<void> {
  await mkdir(SYNC_DIR, { recursive: true })
  await writeFile(LATEST_SYNC_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
}

async function syncNewsItem(source: SourceDescriptor, item: NewsItem, body: string[]): Promise<ImportedNews | null> {
  const snapshot = await readLatestSync()
  const excerpt = body[0] ?? item.title
  const filename = `${item.date}_${source.name}_${slugify(item.title)}.json`
  const author = source.name === "fia" ? "FIA" : source.name === "formula1" ? "Formula 1" : "Last Word on Sports"
  const existing = snapshot.items.some((entry) => entry.filename === filename || entry.url === item.url)
  const syncedItem: SyncedNewsItem = {
    filename,
    source: source.name,
    title: item.title,
    excerpt: excerpt.slice(0, 240),
    readTime: estimateReadTime(body),
    date: item.date,
    time: item.time ?? null,
    author,
    url: item.url,
    fetchedAt: new Date().toISOString(),
    body,
  }

  snapshot.items = [
    syncedItem,
    ...snapshot.items.filter((entry) => entry.filename !== filename && entry.url !== item.url),
  ].slice(0, OUTPUT_LIMIT * SOURCES.length)
  snapshot.syncedAt = new Date().toISOString()
  await writeLatestSync(snapshot)

  if (existing) return null
  return { source: syncedItem.source, title: syncedItem.title, date: syncedItem.date, url: syncedItem.url, filename }
}

function splitMessage(text: string): string[] {
  if (text.length <= MESSAGE_LIMIT) return [text]

  const parts: string[] = []
  let buffer = ""
  for (const line of text.split("\n")) {
    const candidate = buffer ? `${buffer}\n${line}` : line
    if (candidate.length > MESSAGE_LIMIT) {
      if (buffer) parts.push(buffer)
      buffer = line
      continue
    }
    buffer = candidate
  }

  if (buffer) parts.push(buffer)
  return parts.length > 0 ? parts : [text.slice(0, MESSAGE_LIMIT)]
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  for (const chunk of splitMessage(text)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      throw new Error(`Telegram API sendMessage falhou: HTTP ${res.status}`)
    }
  }
}

async function notifyImportedNews(items: ImportedNews[]): Promise<void> {
  if (items.length === 0) return

  const lines = [
    `News sincronizadas: ${items.length}`,
    "",
    ...items.map((item) => `[${item.source}] ${item.title} (${item.date}) ${item.url}`),
  ]

  await sendTelegramMessage(lines.join("\n"))
}

export async function syncNews(maxNews = OUTPUT_LIMIT, notify = true): Promise<ImportedNews[]> {
  const imported: ImportedNews[] = []
  for (const source of SOURCES) {
    imported.push(...(await processSource(source, maxNews)))
  }

  if (notify) {
    await notifyImportedNews(imported)
  }

  return imported
}

async function listFormula1(url: string): Promise<NewsItem[]> {
  const html = await fetchHtml(url)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  for (const article of html.matchAll(/<article[\s\S]*?<\/article>/gi)) {
    if (items.length >= OUTPUT_LIMIT) break
    const block = article[0]
    const href = block.match(/href=["']([^"']*(?:\/en\/latest|\/news\/)[^"']*)["']/i)?.[1]
    if (!href) continue
    const urlAbs = absoluteUrl("https://www.formula1.com", href)
    if (seen.has(urlAbs)) continue
    seen.add(urlAbs)

    const title = stripTags(block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] ?? extractAttr(block, "a", "aria-label") ?? extractAttr(block, "a", "title") ?? "")
    if (!title) continue

    const time = block.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1]
    const { date, time: extractedTime } = extractDateFromIso(time)
    items.push({ title, url: urlAbs, date: date ?? new Date().toISOString().slice(0, 10), time: extractedTime })
  }

  if (items.length === 0) {
    for (const match of html.matchAll(/<a[^>]+href=["']([^"']*(?:\/en\/latest|\/news\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      if (items.length >= OUTPUT_LIMIT) break
      const href = match[1]
      const urlAbs = absoluteUrl("https://www.formula1.com", href)
      if (seen.has(urlAbs) || urlAbs.replace(/\/$/, "") === url.replace(/\/$/, "")) continue
      seen.add(urlAbs)

      const title = stripTags(match[2]).slice(0, 200)
      if (!title || title.length < 10) continue

      items.push({ title, url: urlAbs, date: new Date().toISOString().slice(0, 10), time: null })
    }
  }

  return items
}

async function listFia(url: string): Promise<NewsItem[]> {
  const html = await fetchHtml(url)
  const directItems = parseFiaNewsLinks(html)
  if (directItems.length > 0) return directItems

  const domId = html.match(/views_dom_id["\s:]+([a-f0-9]{10,})/i)?.[1]
  if (!domId) return []

  const res = await fetch("https://www.fia.com/views/ajax", {
    method: "POST",
    cache: "no-store",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      view_name: "news",
      view_display_id: "news_list",
      view_path: "news/tags/f1-245",
      view_args: "",
      view_dom_id: domId,
      pager_element: "0",
      page: "0",
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) return []
  const payload = (await res.json()) as Array<{ command?: string; data?: string }>
  const htmlList = payload.find((item) => item.command === "insert" && item.data)?.data ?? ""
  return parseFiaNewsLinks(htmlList)
}

async function listLastWordOnSports(url: string): Promise<NewsItem[]> {
  const html = await fetchHtml(url)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  for (const article of html.matchAll(/<article[\s\S]*?<\/article>/gi)) {
    if (items.length >= OUTPUT_LIMIT) break
    const block = article[0]
    const link = block.match(/href=["']([^"']*\/motorsports\/[^"']*)["']/i)?.[1]
    const title = stripTags(block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] ?? "")
    if (!link || !title) continue

    const urlAbs = absoluteUrl("https://lastwordonsports.com", link)
    if (seen.has(urlAbs)) continue
    seen.add(urlAbs)

    const dateMatch = urlAbs.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//)
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10)
    items.push({ title, url: urlAbs, date, time: null })
  }

  return items
}

function extractNewsBody(html: string): string[] {
  const regions = [
    /<div[^>]*class=["'][^"']*(?:f1-article__content|article.?content|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*(?:field--name-body|field--type-text-with-summary|node__content|article__content|main.?content|news.?content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]

  for (const region of regions) {
    const match = html.match(region)
    if (match?.[1]) {
      const paragraphs = extractParagraphs(match[1]).filter((text) => text.length > 20)
      if (paragraphs.length > 0) return paragraphs
    }
  }

  return extractParagraphs(html).filter((text) => text.length > 20)
}

function extractNewsMeta(html: string): { date: string | null; time: string | null } {
  const jsonLd = extractJsonLdDate(html)
  if (jsonLd.date) return { date: jsonLd.date, time: jsonLd.time }

  const timeAttr = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1]
  if (timeAttr) return extractDateFromIso(timeAttr)

  const meta = extractMeta(html)
  if (meta) return extractDateFromIso(meta)

  return { date: null, time: null }
}

async function extractFormula1(url: string): Promise<{ body: string[]; date: string | null; time: string | null }> {
  const html = await fetchHtml(url)
  const meta = extractNewsMeta(html)
  const body = extractNewsBody(html)
  return { body, ...meta }
}

async function extractFia(url: string): Promise<{ body: string[]; date: string | null; time: string | null }> {
  const html = await fetchHtml(url)
  const meta = extractNewsMeta(html)
  const body = extractNewsBody(html)
  return { body, ...meta }
}

async function extractLastWordOnSports(url: string): Promise<{ body: string[]; date: string | null; time: string | null }> {
  const html = await fetchHtml(url)
  const meta = extractNewsMeta(html)
  const body = extractNewsBody(html)
  return { body, ...meta }
}

async function processSource(source: SourceDescriptor, maxNews: number): Promise<ImportedNews[]> {
  console.log(`\n=== ${source.name.toUpperCase()} ===`)

  let items: NewsItem[] = []
  try {
    items = await source.list(source.url)
  } catch (error) {
    console.log(`  [erro-listagem] ${error instanceof Error ? error.message : String(error)}`)
    return []
  }

  const limited = items
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? ""))
    .slice(0, maxNews)
  const imported: ImportedNews[] = []

  console.log(`Encontradas ${limited.length} notícia(s)`)

  for (const item of limited) {
    if (isBlockedTitle(item.title)) {
      console.log(`  [bloqueada] ${item.title}`)
      continue
    }

    try {
      const extracted = await source.extract(item.url)
      if (extracted.body.length === 0) {
        console.log(`  [vazia] ${item.title}`)
        continue
      }

      const importedItem = await syncNewsItem(source, { ...item, date: extracted.date ?? item.date, time: extracted.time ?? item.time ?? null }, extracted.body)
      if (importedItem) {
        console.log(`  [nova] ${item.title}`)
        imported.push(importedItem)
      } else {
        console.log(`  [existente] ${item.title}`)
      }
    } catch (error) {
      console.log(`  [erro] ${item.title} - ${error instanceof Error ? error.message : String(error)}`)
    }

    await sleep(DELAY_MS)
  }

  return imported
}

async function main(): Promise<void> {
  const maxArg = Number(process.argv[2])
  const maxNews = Number.isFinite(maxArg) && maxArg > 0 ? maxArg : OUTPUT_LIMIT

  console.log(`\nF1 News Collector — máximo ${maxNews} por fonte\n`)

  const imported = await syncNews(maxNews)
  console.log(`\nConcluído. ${imported.length} notícia(s) nova(s) sincronizada(s) em ${LATEST_SYNC_FILE}.`)
}

main().catch((error) => {
  console.error("\n[erro] Falha ao coletar notícias:", error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

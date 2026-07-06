import fs from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { chromium, type Browser, type Page } from "@playwright/test"
import { eq } from "drizzle-orm"
import { config as loadEnv } from "dotenv"

import { getDb } from "../lib/db/client"
import { mediaGalleries } from "../lib/db/schema"

loadEnv({ path: ".env.local" })
loadEnv()

const execFileAsync = promisify(execFile)
const OUTPUT_DIR = path.join(process.cwd(), "f1_2026_fotos")
const SOURCE_KEY = "motorsport_uol"
const MOTORSPORT_INDEX = "https://www.motorsport.com/f1/galleries/"
const DELAY_MS = 300
const DOWNLOAD_WORKERS = 6
const DEFAULT_DAYS = 60
const STOP_AFTER_DAYS = 90
const PREVIOUS_YEARS = ["2025", "2024", "2023", "2022", "2021", "2020"]
const IGNORED_IMAGE_NAMES = /(app_store|google_play|motogp-|img\d{10,})/i
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

const GP_TITLES_PT: Record<string, string> = {
  australian: "GP da Australia",
  chinese: "GP da China",
  japanese: "GP do Japao",
  bahrain: "GP do Bahrein",
  "saudi arabian": "GP da Arabia Saudita",
  miami: "GP de Miami",
  "emilia romagna": "GP da Emilia-Romagna",
  monaco: "GP de Monaco",
  spanish: "GP da Espanha",
  canadian: "GP do Canada",
  austrian: "GP da Austria",
  british: "GP da Inglaterra",
  belgian: "GP da Belgica",
  hungarian: "GP da Hungria",
  dutch: "GP da Holanda",
  italian: "GP da Italia",
  azerbaijan: "GP do Azerbaijao",
  singapore: "GP de Singapura",
  "united states": "GP dos Estados Unidos",
  "mexico city": "GP da Cidade do Mexico",
  "sao paulo": "GP de Sao Paulo",
  "las vegas": "GP de Las Vegas",
  qatar: "GP do Catar",
  "abu dhabi": "GP de Abu Dhabi",
}

const DAYS_PT: Record<string, string> = {
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sabado",
  sunday: "Domingo",
}

type Gallery = {
  url: string
  title: string
  daysAgo: number
}

type Args = {
  noSync: boolean
  cleanup: boolean
  forceSync: boolean
  maxGalleries: number | null
  days: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const getNumber = (name: string): number | null => {
    const index = args.indexOf(name)
    if (index === -1) return null
    const value = Number(args[index + 1])
    return Number.isFinite(value) && value > 0 ? value : null
  }

  return {
    noSync: args.includes("--no-sync"),
    cleanup: args.includes("--cleanup"),
    forceSync: args.includes("--force-sync"),
    maxGalleries: getNumber("--max-galleries"),
    days: getNumber("--days") ?? DEFAULT_DAYS,
  }
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80)
}

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function absoluteUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  return new URL(href, base).toString()
}

function parseRelativeDays(text: string): number {
  const match = text.toLowerCase().trim().match(/(\d+)\s*([hdm])/) 
  if (!match) return 999
  const value = Number(match[1])
  const unit = match[2]
  if (unit === "h") return value / 24
  if (unit === "d") return value
  if (unit === "m") return value * 30
  return 999
}

function normalizeGalleryTitle(title: string): string {
  const match = title.match(/^(.+?)\s*(?:GP|Grand Prix)\s*-\s*(Thursday|Friday|Saturday|Sunday)(?:,\s*in\s+photos)?$/i)
  if (!match) return title

  const gpName = GP_TITLES_PT[match[1].trim().toLowerCase()]
  const dayName = DAYS_PT[match[2].trim().toLowerCase()]
  return gpName && dayName ? `${gpName} - ${dayName}, em fotos` : title
}

function equivalentFolderKeys(title: string): Set<string> {
  return new Set([title, normalizeGalleryTitle(title)].map((value) => `${SOURCE_KEY}/${slugify(value)}`))
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`)
  return response.text()
}

async function loadSyncedGalleryKeys(): Promise<Set<string>> {
  const db = getDb()
  if (!db) return new Set()

  const rows = await db
    .select({ folderKey: mediaGalleries.folderKey })
    .from(mediaGalleries)
    .where(eq(mediaGalleries.category, "PHOTOS"))

  return new Set(rows.map((row) => row.folderKey).filter(Boolean) as string[])
}

function parseGalleryCards(html: string, baseUrl: string): Gallery[] {
  const galleries: Gallery[] = []
  const anchors = html.match(/<a\b[^>]*class=["'][^"']*ms-item--photo-gallery[^"']*["'][\s\S]*?<\/a>/gi) ?? []

  for (const anchor of anchors) {
    const href = anchor.match(/href=["']([^"']+)["']/i)?.[1]
    const titleRaw = anchor.match(/<p\b[^>]*class=["'][^"']*ms-item__title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
    const timeRaw = anchor.match(/<time\b[^>]*class=["'][^"']*ms-item__date[^"']*["'][^>]*>([\s\S]*?)<\/time>/i)?.[1]
    const title = titleRaw ? stripTags(titleRaw) : ""
    if (!href || !title) continue

    galleries.push({
      url: absoluteUrl(baseUrl, href),
      title,
      daysAgo: timeRaw ? parseRelativeDays(stripTags(timeRaw)) : 999,
    })
  }

  return galleries
}

async function discoverGalleries(days: number): Promise<Gallery[]> {
  const galleries = new Map<string, Gallery>()
  let page = 1

  for (;;) {
    const url = page === 1 ? MOTORSPORT_INDEX : `${MOTORSPORT_INDEX}?page=${page}`
    console.log(`   Verificando indice (pag. ${page}): ${url}`)
    const html = await fetchText(url)
    const cards = parseGalleryCards(html, MOTORSPORT_INDEX)

    let foundNew = false
    let shouldStop = false

    for (const gallery of cards) {
      const searchable = `${gallery.title} ${gallery.url}`.toLowerCase()
      if (PREVIOUS_YEARS.some((year) => searchable.includes(year))) continue

      if (gallery.daysAgo < days) {
        if (!galleries.has(gallery.url)) {
          galleries.set(gallery.url, gallery)
          console.log(`    [ok] [${Math.floor(gallery.daysAgo)}d] ${gallery.title}`)
          foundNew = true
        }
      } else if (gallery.daysAgo >= STOP_AFTER_DAYS) {
        shouldStop = true
      }
    }

    if (!foundNew || shouldStop || !html.match(/next|proxima|›|»/i)) break
    page += 1
    await sleep(DELAY_MS)
  }

  return [...galleries.values()]
}

async function filterUnsyncedGalleries(galleries: Gallery[]): Promise<Gallery[]> {
  const syncedKeys = await loadSyncedGalleryKeys()
  if (syncedKeys.size === 0) return galleries

  return galleries.flatMap((gallery) => {
    const normalized = normalizeGalleryTitle(gallery.title)
    const keys = equivalentFolderKeys(gallery.title)
    for (const key of keys) {
      if (syncedKeys.has(key)) {
        console.log(`    [ok] ja sincronizada no servidor: ${normalized}`)
        return []
      }
    }
    return [{ ...gallery, title: normalized }]
  })
}

async function setupBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BINARY || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1920,1080"],
  })
}

async function scrollToLoad(page: Page): Promise<void> {
  let previousHeight = 0
  for (let i = 0; i < 30; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const height = await page.evaluate(() => document.body.scrollHeight)
    if (height === previousHeight) break
    previousHeight = height
  }
}

function extractImageUrls(html: string): string[] {
  const seenIds = new Set<string>()
  const urls: string[] = []

  for (const size of ["s1100", "s800"]) {
    const pattern = new RegExp(`https://cdn-\\d+\\.motorsport\\.com/images/mgl/[A-Za-z0-9]+/${size}/[^\"'\\s<>]+\\.(?:jpg|webp)`, "g")
    for (const url of html.match(pattern) ?? []) {
      const imageId = url.match(new RegExp(`/mgl/([A-Za-z0-9]+)/${size}/`))?.[1]
      const name = url.split("/").pop() ?? ""
      if (!imageId || seenIds.has(imageId) || IGNORED_IMAGE_NAMES.test(name)) continue
      seenIds.add(imageId)
      urls.push(url)
    }
    if (urls.length > 0) break
  }

  return urls
}

async function extractGalleryImages(browser: Browser, galleryUrl: string): Promise<string[]> {
  const page = await browser.newPage({ userAgent: HEADERS["User-Agent"] })
  const allImages: string[] = []
  const seenIds = new Set<string>()

  try {
    for (let pageNumber = 1; pageNumber < 50; pageNumber += 1) {
      const pageUrl = pageNumber === 1 ? galleryUrl : `${galleryUrl.replace(/\/$/, "")}/?p=${pageNumber}`
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
      await page.waitForTimeout(1500)
      await scrollToLoad(page)

      const images = extractImageUrls(await page.content())
      const newImages = images.filter((url) => {
        const imageId = url.match(/\/mgl\/([A-Za-z0-9]+)\/s\d+\//)?.[1]
        if (!imageId || seenIds.has(imageId)) return false
        seenIds.add(imageId)
        return true
      })

      if (newImages.length === 0) break
      console.log(`     Pagina ${pageNumber}: +${newImages.length} imagens`)
      allImages.push(...newImages)
    }
  } finally {
    await page.close()
  }

  return allImages
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function downloadImage(url: string, destination: string): Promise<"downloaded" | "exists" | "error"> {
  if (await fileExists(destination)) return "exists"

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (!response.headers.get("content-type")?.includes("image")) throw new Error("resposta nao e imagem")

    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(destination, buffer)
    console.log(`    [ok] ${path.basename(destination)}`)
    return "downloaded"
  } catch (error) {
    console.log(`    [erro] ${error instanceof Error ? error.message : String(error)}`)
    return "error"
  }
}

async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function next(): Promise<void> {
    for (;;) {
      const current = index
      index += 1
      if (current >= items.length) return
      results[current] = await worker(items[current])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()))
  return results
}

async function processGallery(browser: Browser, gallery: Gallery, sourceDir: string): Promise<{ newImages: number; totalImages: number }> {
  const title = normalizeGalleryTitle(gallery.title)
  const galleryDir = path.join(sourceDir, slugify(title))
  await fs.mkdir(galleryDir, { recursive: true })
  await fs.writeFile(path.join(galleryDir, "_titulo.txt"), title, "utf8")

  console.log(`\n   ${title}`)
  const images = await extractGalleryImages(browser, gallery.url)
  if (images.length === 0) {
    console.log("    [aviso] Nenhuma imagem encontrada.")
    return { newImages: 0, totalImages: 0 }
  }

  console.log(`     Total encontrado: ${images.length} imagens`)
  const tasks = images.map((imageUrl, i) => {
    const originalName = imageUrl.split("/").pop() ?? `image-${i + 1}.jpg`
    const fileName = originalName.match(/\.(jpg|webp)$/i) ? originalName : `${originalName}.jpg`
    return {
      imageUrl,
      destination: path.join(galleryDir, `${String(i + 1).padStart(3, "0")}_${fileName}`),
    }
  })

  const results = await runLimited(tasks, DOWNLOAD_WORKERS, (task) => downloadImage(task.imageUrl, task.destination))
  const newImages = results.filter((result) => result === "downloaded").length
  console.log(`     ${newImages} novas | ${images.length - newImages} ja existiam | total: ${images.length}`)
  return { newImages, totalImages: images.length }
}

async function runSync(args: Args): Promise<void> {
  if (args.noSync) {
    console.log("\n  Sincronizacao ignorada por --no-sync")
    return
  }

  console.log("\n  Iniciando sincronizacao das galerias...")
  const syncArgs = ["scripts/sync-fotos.ts"]
  if (args.forceSync) syncArgs.push("--force")
  if (args.cleanup) syncArgs.push("--cleanup")

  const { stdout, stderr } = await execFileAsync("./node_modules/.bin/tsx", syncArgs, {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
  })
  if (stdout.trim()) console.log(stdout.trim())
  if (stderr.trim()) console.error(stderr.trim())
}

async function main(): Promise<void> {
  const args = parseArgs()
  const startedAt = Date.now()
  const sourceDir = path.join(OUTPUT_DIR, SOURCE_KEY)

  await fs.mkdir(sourceDir, { recursive: true })
  console.log(`\n  F1 Photo Scraper - ${new Date().toLocaleString("pt-BR")}`)
  console.log(`  Salvando em: ${OUTPUT_DIR}\n`)
  console.log("============================================================")
  console.log(" MOTORSPORT")
  console.log("============================================================")

  let galleries = await discoverGalleries(args.days)
  galleries = await filterUnsyncedGalleries(galleries)
  if (args.maxGalleries) galleries = galleries.slice(0, args.maxGalleries)
  console.log(`\n    ${galleries.length} galeria(s) pendente(s)\n`)

  let totalNew = 0
  let totalProcessed = 0
  if (galleries.length > 0) {
    console.log("  Iniciando Chrome WebDriver...")
    const browser = await setupBrowser()
    try {
      for (const gallery of galleries) {
        const result = await processGallery(browser, gallery, sourceDir)
        totalNew += result.newImages
        totalProcessed += result.totalImages
      }
    } finally {
      await browser.close()
    }
  } else {
    console.log("  Nenhuma galeria nova encontrada.")
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
  console.log("\n============================================================")
  console.log(`  Concluido em ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`)
  console.log(`  Novas imagens baixadas: ${totalNew}`)
  console.log(`  Total processado:       ${totalProcessed}`)
  console.log("============================================================")

  await runSync(args)
}

main().catch((error) => {
  console.error("\n[erro] Falha no scrape de fotos:", error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

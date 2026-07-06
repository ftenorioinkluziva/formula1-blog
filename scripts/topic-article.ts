import { GoogleGenerativeAI } from "@google/generative-ai"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { config as loadEnv } from "dotenv"

import { getDb } from "../lib/db/client"
import { drivers, galleryImages, mediaGalleries, newsArticles, raceSessions, raceWeekends, sessionResults, teams } from "../lib/db/schema"
import { upsertImportedPendingArticle } from "../lib/db/pending-articles"

loadEnv({ path: ".env.local" })
loadEnv()

const STOP_WORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "que",
  "se",
  "sobre",
  "um",
  "uma",
  "com",
  "sem",
  "entre",
  "mais",
  "menos",
  "grande",
  "premio",
  "gp",
])

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

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("```")) return trimmed
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function getGeminiApiKey(): string {
  return process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ""
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function tokenizeTopic(topic: string): string[] {
  const normalized = normalizeForSearch(topic)
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part))

  return Array.from(new Set(tokens))
}

function isRaceResultTopic(topic: string): boolean {
  const normalized = normalizeForSearch(topic)
  return /\bresultado\b|\bresultados\b|\bresult\b|\bclassificacao\b|\bchegada\b|\bvencedor\b|\bvenceu\b/.test(normalized)
}

function expandWeekendSearchTerms(topic: string): string[] {
  const terms = tokenizeTopic(topic)
  const normalized = normalizeForSearch(topic)

  if (normalized.includes("silverstone")) {
    terms.push("british", "inglaterra", "gra-bretanha", "great", "britain")
  }

  return Array.from(new Set(terms))
}

function scoreOccurrences(text: string, terms: string[]): { score: number; matchedTerms: string[] } {
  if (terms.length === 0) return { score: 0, matchedTerms: [] }

  const normalized = normalizeForSearch(text)
  let score = 0
  const matchedTerms: string[] = []

  for (const term of terms) {
    if (!normalized.includes(term)) continue
    matchedTerms.push(term)
    const occurrences = normalized.split(term).length - 1
    score += occurrences > 1 ? 1 + Math.min(occurrences, 3) * 0.5 : 1
  }

  return { score, matchedTerms }
}

type RelevanceCandidate = {
  id: number
  title: string
  excerpt: string
  category: string
  publishedDate: Date
  body: string[]
  score: number
  matchedTerms: string[]
}

type NewsSyncItem = {
  source?: string
  title?: string
  date?: string
  excerpt?: string
  author?: string
  readTime?: string
  body?: string[]
}

type NewsSyncSnapshot = {
  syncedAt?: string
  items?: NewsSyncItem[]
}

async function getRandomGalleryImage(): Promise<string | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db
    .select({ imageUrl: galleryImages.imageUrl })
    .from(galleryImages)
    .orderBy(sql`RANDOM()`)
    .limit(1)

  return rows[0]?.imageUrl ?? null
}

async function getTopicGalleryImage(topic: string): Promise<string | null> {
  const db = getDb()
  if (!db) return null

  const terms = expandWeekendSearchTerms(topic)
  if (terms.length === 0) return null

  const rows = await db
    .select({
      title: mediaGalleries.title,
      folderKey: mediaGalleries.folderKey,
      coverImageUrl: mediaGalleries.coverImageUrl,
      imageUrl: galleryImages.imageUrl,
      sortOrder: galleryImages.sortOrder,
    })
    .from(galleryImages)
    .innerJoin(mediaGalleries, eq(galleryImages.galleryId, mediaGalleries.id))
    .orderBy(desc(mediaGalleries.createdAt), asc(galleryImages.sortOrder))
    .limit(500)

  const scored = rows
    .map((row) => {
      const haystack = normalizeForSearch(`${row.title} ${row.folderKey ?? ""}`)
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
      return { ...row, score }
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.sortOrder - right.sortOrder)

  return scored[0]?.coverImageUrl ?? scored[0]?.imageUrl ?? null
}

async function readNewsSyncSnapshot(): Promise<NewsSyncItem[]> {
  try {
    const file = join(process.cwd(), "data", "news-sync", "latest.json")
    const raw = await readFile(file, "utf8")
    const parsed = JSON.parse(raw) as NewsSyncSnapshot
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

async function buildRaceResultContext(topic: string): Promise<string> {
  if (!isRaceResultTopic(topic)) {
    return ""
  }

  const db = getDb()
  if (!db) return ""

  const searchTerms = expandWeekendSearchTerms(topic)
  const weekends = await db
    .select({
      id: raceWeekends.id,
      season: raceWeekends.season,
      round: raceWeekends.round,
      grandPrixName: raceWeekends.grandPrixName,
      circuit: raceWeekends.circuit,
      country: raceWeekends.country,
      location: raceWeekends.location,
    })
    .from(raceWeekends)
    .orderBy(desc(raceWeekends.season), desc(raceWeekends.round))

  const weekend = weekends.find((item) => {
    const haystack = normalizeForSearch(
      `${item.grandPrixName} ${item.circuit} ${item.country} ${item.location}`,
    )
    return searchTerms.some((term) => haystack.includes(term))
  })

  if (!weekend) {
    return ""
  }

  const [raceSession] = await db
    .select({
      id: raceSessions.id,
      sessionType: raceSessions.sessionType,
      status: raceSessions.status,
      startTimeUtc: raceSessions.startTimeUtc,
      endTimeUtc: raceSessions.endTimeUtc,
    })
    .from(raceSessions)
    .where(and(eq(raceSessions.weekendId, weekend.id), eq(raceSessions.sessionType, "Race")))
    .limit(1)

  if (!raceSession) {
    return ""
  }

  const rows = await db
    .select({
      position: sessionResults.position,
      driver: drivers.fullName,
      code: drivers.code,
      team: teams.name,
      gridPosition: sessionResults.gridPosition,
      lapsCompleted: sessionResults.lapsCompleted,
      status: sessionResults.status,
      points: sessionResults.points,
      fastestLapRank: sessionResults.fastestLapRank,
    })
    .from(sessionResults)
    .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(eq(sessionResults.sessionId, raceSession.id))
    .orderBy(asc(sessionResults.position))

  if (rows.length === 0) {
    return [
      "=== OFFICIAL RACE RESULT CONTEXT ===",
      `Topic asks for a race result, but no stored Race result rows were found for ${weekend.season} R${weekend.round} ${weekend.grandPrixName}.`,
      "Do not invent finishing order. Say the official result is not available in the local data yet.",
    ].join("\n")
  }

  const winner = rows[0]
  const podium = rows.slice(0, 3).map((row) => `${row.position}. ${row.driver} (${row.team})`).join("; ")
  const topTen = rows.slice(0, 10).map((row) => {
    const grid = row.gridPosition != null ? `grid P${row.gridPosition}` : "grid n/a"
    const laps = row.lapsCompleted != null ? `${row.lapsCompleted} laps` : "laps n/a"
    const fastestLap = row.fastestLapRank != null ? `, fastest lap rank ${row.fastestLapRank}` : ""
    return `${row.position}. ${row.driver} (${row.team}) - ${row.points} pts, ${grid}, ${laps}, ${row.status}${fastestLap}`
  })

  return [
    "=== OFFICIAL RACE RESULT CONTEXT ===",
    "This block is the primary factual source for the requested result topic. Do not contradict it.",
    `Race: ${weekend.season} R${weekend.round} ${weekend.grandPrixName} at ${weekend.circuit}, ${weekend.country}`,
    `Race session status in calendar table: ${raceSession.status}; scheduled window: ${raceSession.startTimeUtc.toISOString()} to ${raceSession.endTimeUtc.toISOString()}`,
    `Winner: ${winner.driver} (${winner.team})`,
    `Podium: ${podium}`,
    "Top 10:",
    ...topTen,
  ].join("\n")
}

async function buildRelevantNewsContext(topic: string): Promise<{ text: string; sources: RelevanceCandidate[] }> {
  const db = getDb()
  const topicTerms = tokenizeTopic(topic)
  const [rows, snapshotItems] = await Promise.all([
    db
      ? db
        .select({
          id: newsArticles.id,
          title: newsArticles.title,
          excerpt: newsArticles.excerpt,
          category: newsArticles.category,
          publishedDate: newsArticles.publishedDate,
          body: newsArticles.body,
        })
        .from(newsArticles)
      : Promise.resolve([] as Array<{
          id: number
          title: string
          excerpt: string
          category: string
          publishedDate: Date
          body: string[]
        }>),
    readNewsSyncSnapshot(),
  ])

  const syncRows = snapshotItems
    .filter((item): item is Required<Pick<NewsSyncItem, "title" | "date" | "excerpt" | "body">> & NewsSyncItem =>
      Boolean(item.title && item.date && item.excerpt && Array.isArray(item.body) && item.body.length > 0),
    )
    .map((item, index) => ({
      id: 1_000_000 + index,
      title: item.title,
      excerpt: item.excerpt,
      category: item.author ?? item.source ?? "F1",
      publishedDate: new Date(item.date!),
      body: item.body!,
    }))

  const allRows = [...syncRows, ...rows]
  const candidates = allRows
    .map((row) => {
      const titleScore = scoreOccurrences(row.title, topicTerms)
      const excerptScore = scoreOccurrences(row.excerpt, topicTerms)
      const bodyScore = scoreOccurrences(row.body.join(" "), topicTerms)
      const fullText = `${row.title} ${row.excerpt} ${row.body.join(" ")}`
      const fullScore = scoreOccurrences(fullText, topicTerms)

      const score = titleScore.score * 6 + excerptScore.score * 4 + bodyScore.score * 2 + fullScore.score
      const matchedTerms = Array.from(new Set([...titleScore.matchedTerms, ...excerptScore.matchedTerms, ...bodyScore.matchedTerms]))

      return {
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        category: row.category,
        publishedDate: row.publishedDate,
        body: row.body,
        score,
        matchedTerms,
      }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.publishedDate.getTime() - a.publishedDate.getTime())

  const sources = candidates.slice(0, 8)
  if (sources.length === 0) {
    const recent = allRows
      .sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime())
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        category: row.category,
        publishedDate: row.publishedDate,
        body: row.body,
        score: 0,
        matchedTerms: [],
      }))

    return {
      text: [
        "=== RELEVANT BLOG CONTEXT ===",
        `Topic: ${topic}`,
        "No direct matches were found, so use the latest news only as cautious background:",
        ...recent.map((item, index) => `${index + 1}. [${item.publishedDate.toISOString().slice(0, 10)}] [${item.category}] ${item.title} - ${item.excerpt}`),
      ].join("\n"),
      sources: recent,
    }
  }

  return {
    text: [
      "=== RELEVANT BLOG CONTEXT ===",
      `Topic: ${topic}`,
      "Most related news items:",
      ...sources.map((item, index) => {
        const date = item.publishedDate.toISOString().slice(0, 10)
        const matches = item.matchedTerms.length > 0 ? ` | terms: ${item.matchedTerms.join(", ")}` : ""
        return `${index + 1}. [${date}] [${item.category}] ${item.title} - ${item.excerpt}${matches}`
      }),
    ].join("\n"),
    sources,
  }
}

async function buildTopicContext(topic: string): Promise<string> {
  const db = getDb()
  if (!db) return ""

  const [raceResultContext, newsContext, driverRows, teamRows, weekendRows] = await Promise.all([
    buildRaceResultContext(topic),
    buildRelevantNewsContext(topic),
    db
      .select({ fullName: drivers.fullName, points: drivers.points, position: drivers.position, teamName: teams.name })
      .from(drivers)
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .orderBy(asc(drivers.position))
      .limit(5),
    db
      .select({ name: teams.name, points: teams.points, position: teams.position })
      .from(teams)
      .orderBy(asc(teams.position))
      .limit(5),
    db
      .select({ season: raceWeekends.season, round: raceWeekends.round, grandPrixName: raceWeekends.grandPrixName, circuit: raceWeekends.circuit, country: raceWeekends.country })
      .from(raceWeekends)
      .orderBy(desc(raceWeekends.season), desc(raceWeekends.round))
      .limit(5),
  ])

  const driverText = driverRows.map((d) => `${d.position}º ${d.fullName} (${d.teamName}) - ${d.points} pts`).join("\n")
  const teamText = teamRows.map((t) => `${t.position}º ${t.name} - ${t.points} pts`).join("\n")
  const weekendText = weekendRows.map((w) => `R${w.round} ${w.grandPrixName} - ${w.circuit}, ${w.country}`).join("\n")

  return [
    raceResultContext,
    newsContext.text,
    weekendText ? `\nCalendar: recent weekends\n${weekendText}` : "",
    driverText ? `\nDrivers standings\n${driverText}` : "",
    teamText ? `\nConstructors standings\n${teamText}` : "",
  ].filter(Boolean).join("\n")
}

async function generateTopicArticle(topic: string): Promise<{
  title: string
  excerpt: string
  category: string
  readTime: string
  author: string
  body: string[]
  image?: string | null
}> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY nao definido.")
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-2.5-flash" })
  const context = await buildTopicContext(topic)

  const prompt = [
    "You are a Formula 1 editor writing in Brazilian Portuguese.",
    `Write an article exclusively about: ${topic}.`,
    "Use the news and data in the context below as the main factual source. Do not invent facts, names, results or dates that are not supported by the context.",
    "If an OFFICIAL RACE RESULT CONTEXT block is present, it is the primary source: the title, excerpt and body must reflect that race result, winner and podium.",
    "If the context is thin, keep the piece analytical and conservative. Do not assert anything that is not supported.",
    "Respond only with valid JSON in this format:",
    '{"title":"...","excerpt":"...","category":"...","readTime":"...","author":"...","body":["..."],"image":null}',
    "Rules:",
    "- title must be concrete and specific",
    "- excerpt must be between 140 and 220 characters",
    "- category can be 'Raio-X Tecnico', 'O Debate na Pista', 'Giro pelo Paddock' or 'Noticias'",
    "- readTime must use the format 'X min read'",
    "- body must have 3 to 6 short paragraphs in Portuguese",
    "- no markdown, no internal headings",
    "- image can be null",
    "",
    context,
  ].join("\n")

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  })

  const parsed = JSON.parse(stripCodeFences(response.response.text())) as Partial<{
    title: string
    excerpt: string
    category: string
    readTime: string
    author: string
    body: string[]
    image: string | null
  }>

  const body = Array.isArray(parsed.body) ? parsed.body.map((part) => normalizeText(part)).filter(Boolean) : []
  if (!parsed.title || !parsed.excerpt || body.length === 0) {
    throw new Error("JSON do Gemini incompleto.")
  }

  return {
    title: parsed.title.trim(),
    excerpt: parsed.excerpt.trim(),
    category: parsed.category?.trim() || "Noticias",
    readTime: parsed.readTime?.trim() || `${Math.max(2, Math.ceil(countWords(body.join(" ")) / 220))} min read`,
    author: parsed.author?.trim() || "F1 Paddock Insider",
    body,
    image: parsed.image ?? null,
  }
}

export async function createTopicPendingArticle(topic: string): Promise<{ id: number | null; title: string }> {
  const article = await generateTopicArticle(topic)
  const image = article.image ?? (await getTopicGalleryImage(topic)) ?? (await getRandomGalleryImage())
  const filename = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}_topic_${slugify(topic)}.json`

  const id = await upsertImportedPendingArticle({
    filename,
    template: "topic",
    source: "telegram-topic",
    generatedAt: new Date(),
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    readTime: article.readTime,
    date: new Date().toLocaleDateString("pt-BR"),
    author: article.author,
    image: image ?? null,
    body: article.body,
  })

  if (!id) {
    throw new Error("Failed to persist topic article as pending item.")
  }

  return { id, title: article.title }
}

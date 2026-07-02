import { GoogleGenerativeAI } from "@google/generative-ai"
import { asc, desc, eq, sql } from "drizzle-orm"
import { config as loadEnv } from "dotenv"

import { getDb } from "../lib/db/client"
import { drivers, galleryImages, newsArticles, raceWeekends, teams } from "../lib/db/schema"
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

async function buildRelevantNewsContext(topic: string): Promise<{ text: string; sources: RelevanceCandidate[] }> {
  const db = getDb()
  if (!db) return { text: "", sources: [] }

  const topicTerms = tokenizeTopic(topic)
  const rows = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      excerpt: newsArticles.excerpt,
      category: newsArticles.category,
      publishedDate: newsArticles.publishedDate,
      body: newsArticles.body,
    })
    .from(newsArticles)

  const candidates = rows
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
    const recent = rows
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

  const [newsContext, driverRows, teamRows, weekendRows] = await Promise.all([
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
  const image = article.image ?? (await getRandomGalleryImage())
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

  return { id, title: article.title }
}

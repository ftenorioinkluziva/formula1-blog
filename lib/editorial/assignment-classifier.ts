import { GoogleGenerativeAI } from "@google/generative-ai"
import { eq, desc, inArray } from "drizzle-orm"

import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import { AssignmentType, EditorialDesk } from "./types"

export interface ClassificationResult {
  assignmentType: AssignmentType
  editorialDesk: EditorialDesk
  season: number | null
  round: number | null
  sessionId: number | null
  topicCanonical: string
  confidence: number
  blockingReason: string | null
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getGeminiApiKey(): string {
  return process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ""
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("```")) return trimmed
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
}

export async function classifyAssignment(rawInput: string, locale = "pt"): Promise<ClassificationResult> {
  const db = getDb()
  if (!db) {
    throw new Error("Sem conexao com o banco de dados.")
  }

  // 1. Tokenize input to search for GP names
  const tokens = rawInput
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length >= 3)

  const allWeekends = await db
    .select({
      id: raceWeekends.id,
      grandPrixName: raceWeekends.grandPrixName,
      circuit: raceWeekends.circuit,
      country: raceWeekends.country,
      season: raceWeekends.season,
      round: raceWeekends.round,
    })
    .from(raceWeekends)

  const scoredWeekends = allWeekends
    .map((w) => {
      const haystack = normalizeForSearch(`${w.grandPrixName} ${w.circuit} ${w.country}`)
      const score = tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0)
      return { ...w, score }
    })
    .filter((w) => w.score > 0)
    .sort((a, b) => b.score - a.score)

  const weekendIds = scoredWeekends.map((w) => w.id)
  let sessionsToProvide: any[] = []

  if (weekendIds.length > 0) {
    sessionsToProvide = await db
      .select({
        sessionId: raceSessions.id,
        sessionType: raceSessions.sessionType,
        status: raceSessions.status,
        season: raceWeekends.season,
        round: raceWeekends.round,
        grandPrixName: raceWeekends.grandPrixName,
      })
      .from(raceSessions)
      .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
      .where(inArray(raceSessions.weekendId, weekendIds))
      .orderBy(desc(raceSessions.startTimeUtc))
  } else {
    // Fallback to recent 20 sessions
    sessionsToProvide = await db
      .select({
        sessionId: raceSessions.id,
        sessionType: raceSessions.sessionType,
        status: raceSessions.status,
        season: raceWeekends.season,
        round: raceWeekends.round,
        grandPrixName: raceWeekends.grandPrixName,
      })
      .from(raceSessions)
      .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
      .orderBy(desc(raceSessions.startTimeUtc))
      .limit(20)
  }

  const sessionsContext = sessionsToProvide
    .map(
      (s) =>
        `- ID ${s.sessionId}: ${s.season} Round ${s.round} - ${s.grandPrixName} (${s.sessionType}) [Status: ${s.status}]`
    )
    .join("\n")

  // 2. Setup Gemini client
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("API Key do Gemini nao configurada em GOOGLE_AI_API_KEY.")
  }

  const ai = new GoogleGenerativeAI(apiKey)
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are an expert Formula 1 editorial assignment classifier.
Your job is to classify an input pitch or topic into a canonical assignment and map it to database records.

Input Pitch: "${rawInput}"
Target Locale: "${locale}"

Available Database Sessions:
${sessionsContext}

INSTRUCTIONS:
1. Determine the assignmentType:
   - 'race_result' (for race results/finishing order coverage)
   - 'qualifying_result' (for qualifying or sprint qualifying sessions)
   - 'sprint_result' (for sprint race results)
   - 'race_preview' / 'weekend_preview' (pre-weekend or pre-session commentary where no official results exist yet)
   - 'technical_analysis' (ritmo, tire stints, technical performance analysis)
   - 'strategy_analysis' (pit strategy, undercuts/overcuts, safety car impacts)
   - 'paddock_roundup' (wider grid rumors, quotes from paddock, multiple teams)
   - 'daily_news_roundup' (a general compilation of today's news)
   - 'topic_feature' (for historical, analytical, or generic F1 topics)

2. Determine the editorialDesk (corresponds to editorial desks):
   - 'Resultado GP' (strictly for race results)
   - 'Resultado Qualifying' (strictly for qualifying / sprint qualifying results)
   - 'Raio-X Tecnico' (for stints, tire wear, telemetry analysis)
   - 'O Debate na Pista' (for sports strategy, team dynamics, driver drama)
   - 'Giro pelo Paddock' (agile padddock notes, multiple teams/drivers)
   - 'Preview' (pre-session previews)
   - 'Noticias' (general news, announcements, FIA rules, general reports)

3. Database Matching:
   - If the pitch refers to a specific GP and session type, find the entry in 'Available Database Sessions' that has the matching grandPrixName and sessionType (e.g., 'Japanese Grand Prix' and 'Race'). You MUST return the corresponding ID as 'sessionId', and its 'season' and 'round'.
   - Do NOT return null for sessionId, season, or round if the session name (e.g. Japanese Grand Prix) and type (e.g. Race) match any available database session!
   - If the matched session status is 'cancelled', or is in the future but results are requested, specify a 'blockingReason'.
   - If it refers to a GP generally but no specific session, match the season and round, but set sessionId to null.
   - If it does not match any session in the database, set sessionId, season, and round to null.

4. Provide a 'topicCanonical' in the target locale (Portuguese: pt, English: en, Spanish: es). This should be a clean, canonical title. E.g., "Grande Prêmio da Áustria de 2026 - Corrida" or "Anúncio Oficial da FIA".

5. Set a confidence float between 0.0 and 1.0.

Return ONLY a valid JSON object matching this schema, with no markdown fences, no comments, no extra text:
{
  "assignmentType": "race_result" | "qualifying_result" | "sprint_result" | "race_preview" | "weekend_preview" | "technical_analysis" | "strategy_analysis" | "paddock_roundup" | "daily_news_roundup" | "topic_feature",
  "editorialDesk": "Noticias" | "Resultado GP" | "Resultado Qualifying" | "Raio-X Tecnico" | "O Debate na Pista" | "Giro pelo Paddock" | "Preview",
  "season": number | null,
  "round": number | null,
  "sessionId": number | null,
  "topicCanonical": "string",
  "confidence": number,
  "blockingReason": "string" | null
}`

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  })

  const responseText = stripCodeFences(response.response.text())
  try {
    const result = JSON.parse(responseText) as ClassificationResult
    return {
      assignmentType: result.assignmentType ?? "topic_feature",
      editorialDesk: result.editorialDesk ?? "Noticias",
      season: result.season ?? null,
      round: result.round ?? null,
      sessionId: result.sessionId ?? null,
      topicCanonical: result.topicCanonical || rawInput,
      confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
      blockingReason: result.blockingReason ?? null,
    }
  } catch (error) {
    console.error("[classifier] Failed to parse JSON response:", responseText)
    throw new Error(`Falha ao decodificar JSON do classificador: ${error instanceof Error ? error.message : String(error)}`)
  }
}

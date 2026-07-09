import { GoogleGenerativeAI } from "@google/generative-ai"

import { SourcePacket, DraftResult } from "./types"

export interface FactCheckResult {
  status: "pass" | "fail" | "warn"
  score: number
  blockingIssues: string[]
  warnings: string[]
}

function getGeminiApiKey(): string {
  return process.env.GOOGLE_AI_API_KEY ?? ""
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("```")) return trimmed
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
}

export async function runFactCheck(packet: SourcePacket, draft: DraftResult): Promise<FactCheckResult> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("API Key do Gemini nao configurada em GOOGLE_AI_API_KEY.")
  }

  const ai = new GoogleGenerativeAI(apiKey)
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are an independent, strict Formula 1 Fact-Checker.
Your job is to audit a generated draft article against the official Source Packet data (the ground truth).
Identify any factual errors, contradictions, or unsupported claims in the draft.

SOURCE PACKET (Ground Truth Data):
${JSON.stringify(packet, null, 2)}

GENERATED DRAFT ARTICLE:
Category: "${draft.category}"
Title: "${draft.title}"
Excerpt: "${draft.excerpt}"
Body:
${draft.body.map((p, idx) => `[P${idx + 1}] ${p}`).join("\n\n")}

AUDIT RULES:
1. Winner Check: The winner mentioned in the title/excerpt MUST match the driver who finished P1 in the officialResults. If not, this is a blocking issue.
2. Podium Check: The podium mentioned (P1, P2, P3) in the excerpt or body MUST match the official results exactly. If not, this is a blocking issue.
3. Championship Standings: Any mention of driver standings, constructor standings, points, or positions must match the sportingContext standings. If not, this is a blocking issue.
4. DNF/Incidents: Any mention of driver retirements (DNFs) or session incidents must match the status, laps, or raceControlMessages. If a driver is stated to have crashed but there is no evidence in the packet, this is a blocking issue.
5. Tires / Stints / Pit Stops: If the draft asserts tire compounds or pit stop counts, it must be supported by the tireStints or pitStops data. If there are no stints/pit stops in the packet, the draft should not make specific tire compound or pit stop claims (warn if general, block if specific and unsupported).
6. sessionType Mix-up: Ensure the draft does not treat a qualifying session as the race, or a sprint qualifying as the main race, etc. (e.g. stating 'won the race' when it was qualifying). If so, block.
7. Quotes: Ensure any quotes used are backed by statements in recentNews. If not, warn.

OUTPUT REQUIREMENT:
Analyze the draft against the packet. Return ONLY a valid JSON object matching the schema below.
Set 'status' to:
- 'fail' if there are ANY blockingIssues.
- 'warn' if there are no blockingIssues but there are warnings.
- 'pass' if there are no blockingIssues and no warnings.
Set 'score' to a decimal float between 0.0 (totally incorrect) and 1.0 (perfectly correct).

JSON Schema:
{
  "status": "pass" | "fail" | "warn",
  "score": number,
  "blockingIssues": ["string detailing the exact error..."],
  "warnings": ["string detailing the warning..."]
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
    const result = JSON.parse(responseText) as FactCheckResult
    return {
      status: result.status ?? "fail",
      score: typeof result.score === "number" ? result.score : 0.0,
      blockingIssues: Array.isArray(result.blockingIssues) ? result.blockingIssues : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    }
  } catch (error) {
    console.error("[fact-checker] Failed to parse JSON response:", responseText)
    throw new Error(`Falha ao decodificar JSON do fact-checker: ${error instanceof Error ? error.message : String(error)}`)
  }
}

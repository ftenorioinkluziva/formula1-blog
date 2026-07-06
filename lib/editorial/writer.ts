import { GoogleGenerativeAI } from "@google/generative-ai"

import { SourcePacket, DraftResult } from "./types"
import { EditorialTemplate } from "./templates/base-template"
import { resultadoGpTemplate } from "./templates/resultado-gp"
import { noticiasTemplate } from "./templates/noticias"
import { raioXTecnicoTemplate } from "./templates/raio-x-tecnico"
import { resultadoQualifyingTemplate } from "./templates/resultado-qualifying"
import { previewTemplate } from "./templates/preview"

function getGeminiApiKey(): string {
  return process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ""
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("```")) return trimmed
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function getTemplate(editorialDesk: string, assignmentType: string): EditorialTemplate {
  if (editorialDesk === "Resultado GP" || assignmentType === "race_result" || assignmentType === "sprint_result") {
    return resultadoGpTemplate
  }
  if (editorialDesk === "Resultado Qualifying" || assignmentType === "qualifying_result") {
    return resultadoQualifyingTemplate
  }
  if (editorialDesk === "Preview" || assignmentType === "weekend_preview" || assignmentType === "race_preview") {
    return previewTemplate
  }
  if (editorialDesk === "Raio-X Tecnico" || assignmentType === "technical_analysis" || assignmentType === "strategy_analysis") {
    return raioXTecnicoTemplate
  }
  return noticiasTemplate
}

export async function generateDraft(packet: SourcePacket): Promise<DraftResult> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("API Key do Gemini nao configurada em GOOGLE_AI_API_KEY.")
  }

  const template = getTemplate(packet.assignment.editorialDesk, packet.assignment.assignmentType)

  const ai = new GoogleGenerativeAI(apiKey)
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are a Formula 1 sports writer.
Write a high-quality, engaging news article or report in Brazilian Portuguese based strictly on the factual data in the Source Packet JSON.

OFFICIAL FORMULA 1 SPORTING REGULATIONS (formula1.com):
1. Qualifying sessions (traditional Qualifying) define the starting grid of the Grand Prix on Sunday.
2. Sprint Qualifying (also called Sprint Shootout) defines the starting grid of the Sprint race on Saturday.
3. The Sprint race is a short race (100km) that awards points to the top 8 drivers (8-7-6-5-4-3-2-1). Crucially, the Sprint race outcome does NOT define the starting grid of the Grand Prix on Sunday.
4. Practice sessions (FP1, FP2, FP3) are for testing and setup only. No points or grids are decided during practice.
Ensure you strictly follow these rules. Never state that a Sprint race defines the grid for Sunday's Grand Prix.

TEMPLATE GUIDELINES:
- Desk Name / Category: "${template.name}"
- Writer Persona: "${template.persona}"
- Tom / Style: "${template.tom}"
- Allowed Claims:
${template.allowedClaims.map((c) => `  * ${c}`).join("\n")}
- Prohibited Claims:
${template.prohibitedClaims.map((c) => `  * ${c}`).join("\n")}
- Title Rules:
${template.titleRules.map((c) => `  * ${c}`).join("\n")}
- Excerpt Rules:
${template.excerptRules.map((c) => `  * ${c}`).join("\n")}
- Body Structure (Paragraph-by-paragraph requirements):
${template.bodyStructure.map((c) => `  * ${c}`).join("\n")}

${template.customInstructions ? `CUSTOM DESK INSTRUCTIONS:\n${template.customInstructions}\n` : ""}

SOURCE PACKET DATA (JSON):
${JSON.stringify(packet, null, 2)}

OUTPUT REQUIREMENT:
Generate the article and output ONLY a valid JSON object matching the schema below.
Ensure you respond in Brazilian Portuguese.
Ensure there are no internal headings, no markdown in title/excerpt, and body paragraphs are clean text.
Write detailed, rich paragraphs rather than short, robotic sentences. Match the tone of a professional F1 chronicler.

JSON Schema:
{
  "title": "Clean strong title",
  "excerpt": "Clean strong excerpt (strictly between 140 and 220 characters)",
  "body": [
    "Paragraph 1 text...",
    "Paragraph 2 text...",
    "Paragraph 3 text...",
    "Paragraph 4 text..."
  ]
}`

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  })

  const responseText = stripCodeFences(response.response.text())
  try {
    const parsed = JSON.parse(responseText) as { title: string; excerpt: string; body: string[] }
    
    const body = Array.isArray(parsed.body) ? parsed.body.map((p) => p.trim()).filter(Boolean) : []
    if (!parsed.title || !parsed.excerpt || body.length === 0) {
      throw new Error("JSON retornado pelo Gemini esta incompleto.")
    }

    // Resolve readTime
    const wordCount = countWords(body.join(" "))
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 220))
    const readTime = `${readTimeMinutes} min read`

    // Select an image from the top matched items (rotation logic)
    let image: string | null = null
    if (packet.mediaContext.length > 0) {
      const topScore = packet.mediaContext[0].relevanceScore
      // Filter candidates with a score very close to the top score (within 5 points)
      const candidates = packet.mediaContext.filter((m) => m.relevanceScore >= topScore - 5)
      // Pick a random candidate from this group to ensure variety across different sessions
      const randomIndex = Math.floor(Math.random() * candidates.length)
      image = candidates[randomIndex].imageUrl
    }

    return {
      title: parsed.title.trim(),
      excerpt: parsed.excerpt.trim(),
      category: template.name,
      readTime,
      author: "F1 Paddock Insider",
      body,
      image,
    }
  } catch (error) {
    console.error("[writer] Failed to parse JSON response:", responseText)
    throw new Error(`Falha ao decodificar JSON gerado pelo redator: ${error instanceof Error ? error.message : String(error)}`)
  }
}

import { and, desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db/client"
import {
  editorialAssignments,
  editorialSourcePackets,
  editorialReviews,
  articleSourceLinks,
  pendingArticles,
} from "@/lib/db/schema"
import { checkDeduplication } from "./dedupe"
import { buildSourcePacket } from "./source-packet-builder"
import { generateDraft } from "./writer"
import { runFactCheck } from "./fact-checker"

export interface PipelineResult {
  success: boolean
  status: string
  message: string
  pendingArticleId?: number
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

export async function runEditorialPipeline(assignmentId: number): Promise<PipelineResult> {
  const db = getDb()
  if (!db) {
    throw new Error("Sem conexao com o banco de dados.")
  }

  // 1. Fetch the assignment
  const [assignment] = await db
    .select()
    .from(editorialAssignments)
    .where(eq(editorialAssignments.id, assignmentId))
    .limit(1)

  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} nao encontrado no banco.`)
  }

  const now = new Date()

  // 2. Deduplication check
  console.log(`[pipeline] Executando deduplicacao para assignment ${assignmentId}...`)
  const dedupeResult = await checkDeduplication(
    assignment.sessionId,
    assignment.assignmentType,
    assignment.topicCanonical
  )

  if (dedupeResult.status === "duplicate_exact") {
    console.log(`[pipeline] Assignment ${assignmentId} ignorado por duplicidade exata.`)
    await db
      .update(editorialAssignments)
      .set({
        status: "ignored",
        completedAt: now,
        errorLog: dedupeResult.message,
      })
      .where(eq(editorialAssignments.id, assignmentId))

    return {
      success: false,
      status: "ignored",
      message: dedupeResult.message,
    }
  }

  // Update assignment status to drafting / compiling
  await db
    .update(editorialAssignments)
    .set({
      status: "classified", // classified / sourcing
      lockedAt: now,
      lockedBy: "pipeline",
    })
    .where(eq(editorialAssignments.id, assignmentId))

  try {
    // 3. Build Source Packet
    console.log(`[pipeline] Construindo pacote de fontes para assignment ${assignmentId}...`)
    const packet = await buildSourcePacket(assignmentId)

    // Find the packet ID we just created
    const [packetRow] = await db
      .select({ id: editorialSourcePackets.id })
      .from(editorialSourcePackets)
      .where(eq(editorialSourcePackets.assignmentId, assignmentId))
      .orderBy(desc(editorialSourcePackets.createdAt))
      .limit(1)

    const sourcePacketId = packetRow?.id ?? null

    // 4. Generate draft
    console.log(`[pipeline] Redigindo rascunho com a IA...`)
    const draft = await generateDraft(packet)

    // 5. Run Fact-Checker
    console.log(`[pipeline] Validando rascunho no Fact-Checker...`)
    const factCheck = await runFactCheck(packet, draft)
    console.log(`[pipeline] Resultado do Fact-Check: ${factCheck.status} (Score: ${factCheck.score})`)

    // 6. Save as pending_article
    console.log(`[pipeline] Salvando rascunho em pending_articles...`)
    const filename = `${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}_assignment_${assignmentId}_${slugify(assignment.topicCanonical)}.json`
    
    const [pendingRow] = await db
      .insert(pendingArticles)
      .values({
        filename,
        template: "topic",
        source: assignment.source,
        generatedAt: now,
        title: draft.title,
        excerpt: draft.excerpt,
        category: draft.category,
        readTime: draft.readTime,
        date: now.toLocaleDateString("pt-BR"),
        author: draft.author,
        image: draft.image,
        body: draft.body,
        status: "pending",
        assignmentType: assignment.assignmentType,
        editorialDesk: assignment.editorialDesk,
        season: assignment.season,
        round: assignment.round,
        sessionId: assignment.sessionId,
        reviewStatus: factCheck.status,
        confidenceScore: factCheck.score,
        sourcePacketId,
        locale: assignment.locale,
      })
      .returning({ id: pendingArticles.id })

    const pendingArticleId = pendingRow.id

    // 7. Save Review log
    await db.insert(editorialReviews).values({
      assignmentId,
      pendingArticleId,
      reviewType: "fact_check",
      status: factCheck.status,
      score: factCheck.score,
      issuesJson: factCheck.blockingIssues.concat(factCheck.warnings),
    })

    // 8. Save Article Source Links
    // Link to DB official session result if available
    if (assignment.sessionId) {
      await db.insert(articleSourceLinks).values({
        pendingArticleId,
        sourceType: "db_result",
        sourceRef: `session_results:${assignment.sessionId}`,
        sourceLabel: `Resultados oficiais locais da sessão ID ${assignment.sessionId}`,
      })
    }

    // Link to news sync files if any news items matched in the packet
    if (packet.recentNews.length > 0) {
      // Create up to 3 links to the news sources used
      for (const news of packet.recentNews.slice(0, 3)) {
        await db.insert(articleSourceLinks).values({
          pendingArticleId,
          sourceType: "news_sync",
          sourceRef: news.url,
          sourceLabel: `Notícia Sincronizada: "${news.title}" (${news.source})`,
        })
      }
    }

    // 9. Update assignment final status
    const finalStatus = factCheck.status === "fail" ? "review_failed" : "pending_review"
    const errorLog = factCheck.status === "fail" 
      ? `Fact-check falhou (Score: ${factCheck.score}): ${factCheck.blockingIssues.join("; ")}`
      : `Artigo salvo com sucesso [ID ${pendingArticleId}]. Fact-check: ${factCheck.status} (Score: ${factCheck.score})`

    await db
      .update(editorialAssignments)
      .set({
        status: finalStatus,
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        errorLog,
      })
      .where(eq(editorialAssignments.id, assignmentId))

    return {
      success: factCheck.status !== "fail",
      status: finalStatus,
      message: errorLog,
      pendingArticleId,
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[pipeline] Erro fatal no pipeline do assignment ${assignmentId}:`, message)

    await db
      .update(editorialAssignments)
      .set({
        status: "review_failed",
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        errorLog: `Erro no pipeline: ${message}`,
      })
      .where(eq(editorialAssignments.id, assignmentId))

    throw error
  }
}

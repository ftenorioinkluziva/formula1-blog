import { and, eq, isNotNull, ne } from "drizzle-orm"

import { getDb } from "@/lib/db/client"
import { pendingArticles, editorialAssignments } from "@/lib/db/schema"

export interface DedupeResult {
  status: "new" | "duplicate_exact" | "duplicate_angle"
  message: string
  conflictingArticleId?: number
  conflictingTable?: "pending" | "published"
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
}

function getJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(normalizeText(textA).split(/\s+/).filter((w) => w.length >= 4))
  const wordsB = new Set(normalizeText(textB).split(/\s+/).filter((w) => w.length >= 4))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])

  return intersection.size / union.size
}

export async function checkDeduplication(
  sessionId: number | null,
  assignmentType: string,
  topicCanonical: string
): Promise<DedupeResult> {
  const db = getDb()
  if (!db) {
    return { status: "new", message: "Sem conexao com o banco. Ignorando dedupe." }
  }

  // 1. Session-based exact duplicate check
  if (sessionId != null) {
    // Check pending_articles
    const [existingPending] = await db
      .select({ id: pendingArticles.id, title: pendingArticles.title })
      .from(pendingArticles)
      .where(
        and(
          eq(pendingArticles.sessionId, sessionId),
          eq(pendingArticles.assignmentType, assignmentType),
          eq(pendingArticles.status, "pending")
        )
      )
      .limit(1)

    if (existingPending) {
      return {
        status: "duplicate_exact",
        message: `Artigo pendente duplicado encontrado em pending_articles [ID ${existingPending.id}]: "${existingPending.title}"`,
        conflictingArticleId: existingPending.id,
        conflictingTable: "pending",
      }
    }

    // Check editorial_assignments with newsArticleId (published articles)
    const [existingAssignment] = await db
      .select({ id: editorialAssignments.id, newsArticleId: editorialAssignments.newsArticleId, topicCanonical: editorialAssignments.topicCanonical })
      .from(editorialAssignments)
      .where(
        and(
          eq(editorialAssignments.sessionId, sessionId),
          eq(editorialAssignments.assignmentType, assignmentType),
          isNotNull(editorialAssignments.newsArticleId)
        )
      )
      .limit(1)

    if (existingAssignment && existingAssignment.newsArticleId) {
      return {
        status: "duplicate_exact",
        message: `Artigo publicado duplicado encontrado via editorial_assignments [ID ${existingAssignment.newsArticleId}]: "${existingAssignment.topicCanonical}"`,
        conflictingArticleId: existingAssignment.newsArticleId,
        conflictingTable: "published",
      }
    }
  }

  // 2. Fuzzy Title-based Jaccard similarity check (for non-session topics or warnings)
  // Check pending articles
  const pendingList = await db
    .select({ id: pendingArticles.id, title: pendingArticles.title })
    .from(pendingArticles)
    .where(eq(pendingArticles.status, "pending"))
    .limit(50)

  for (const p of pendingList) {
    const similarity = getJaccardSimilarity(topicCanonical, p.title)
    if (similarity >= 0.6) {
      return {
        status: "duplicate_angle",
        message: `Artigo pendente com alta similaridade semantica (Jaccard: ${similarity.toFixed(2)}) encontrado [ID ${p.id}]: "${p.title}"`,
        conflictingArticleId: p.id,
        conflictingTable: "pending",
      }
    }
  }

  // Check published assignments
  const publishedAssignments = await db
    .select({ id: editorialAssignments.id, newsArticleId: editorialAssignments.newsArticleId, topicCanonical: editorialAssignments.topicCanonical })
    .from(editorialAssignments)
    .where(isNotNull(editorialAssignments.newsArticleId))
    .limit(50)

  for (const a of publishedAssignments) {
    if (a.newsArticleId) {
      const similarity = getJaccardSimilarity(topicCanonical, a.topicCanonical)
      if (similarity >= 0.6) {
        return {
          status: "duplicate_angle",
          message: `Artigo publicado com alta similaridade semantica (Jaccard: ${similarity.toFixed(2)}) encontrado [ID ${a.newsArticleId}]: "${a.topicCanonical}"`,
          conflictingArticleId: a.newsArticleId,
          conflictingTable: "published",
        }
      }
    }
  }

  return {
    status: "new",
    message: "Nenhuma duplicidade detectada.",
  }
}

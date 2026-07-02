import { desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { pendingArticles, newsArticles } from "@/lib/db/schema"
import { parseNewsDate } from "@/lib/db/news-date"

export interface PendingArticleItem {
  id: number
  filename: string
  template: string
  source: string
  generatedAt: string
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  author: string
  image?: string
  body: string[]
  status: string
}

export interface ImportedPendingArticleInput {
  filename: string
  template: string
  source: string
  generatedAt: Date
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  author: string
  image?: string | null
  body: string[]
}

function toItem(row: typeof pendingArticles.$inferSelect): PendingArticleItem {
  return {
    id: row.id,
    filename: row.filename,
    template: row.template,
    source: row.source,
    generatedAt: row.generatedAt.toISOString(),
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    readTime: row.readTime,
    date: row.date,
    author: row.author,
    image: row.image ?? undefined,
    body: row.body,
    status: row.status,
  }
}

export async function getPendingArticles(): Promise<PendingArticleItem[]> {
  const db = getDb()
  if (!db) return []
  const rows = await db
    .select()
    .from(pendingArticles)
    .where(eq(pendingArticles.status, "pending"))
    .orderBy(desc(pendingArticles.generatedAt))
  return rows.map(toItem)
}

export async function getPendingArticleById(id: number): Promise<PendingArticleItem | null> {
  const db = getDb()
  if (!db) return null
  const rows = await db.select().from(pendingArticles).where(eq(pendingArticles.id, id)).limit(1)
  return rows[0] ? toItem(rows[0]) : null
}

export async function updatePendingArticle(
  id: number,
  data: Partial<Pick<PendingArticleItem, "title" | "excerpt" | "category" | "readTime" | "date" | "author" | "image" | "body">>,
): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  await db.update(pendingArticles).set(data).where(eq(pendingArticles.id, id))
  return true
}

export async function upsertImportedPendingArticle(input: ImportedPendingArticleInput): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const [row] = await db
    .insert(pendingArticles)
    .values({
      filename: input.filename,
      template: input.template,
      source: input.source,
      generatedAt: input.generatedAt,
      title: input.title,
      excerpt: input.excerpt,
      category: input.category,
      readTime: input.readTime,
      date: input.date,
      author: input.author,
      image: input.image ?? null,
      body: input.body,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: pendingArticles.filename,
      set: {
        template: input.template,
        source: input.source,
        generatedAt: input.generatedAt,
        title: input.title,
        excerpt: input.excerpt,
        category: input.category,
        readTime: input.readTime,
        date: input.date,
        author: input.author,
        image: input.image ?? null,
        body: input.body,
        status: "pending",
        updatedAt: new Date(),
      },
    })
    .returning({ id: pendingArticles.id })

  return row?.id ?? null
}

export async function publishPendingArticle(id: number): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const rows = await db.select().from(pendingArticles).where(eq(pendingArticles.id, id)).limit(1)
  const article = rows[0]
  if (!article) return null

  const [published] = await db
    .insert(newsArticles)
    .values({
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      readTime: article.readTime,
      publishedDate: parseNewsDate(article.date),
      author: article.author,
      body: article.body,
      imageUrl: article.image ?? null,
      isFeatured: false,
      sortOrder: 0,
    })
    .returning({ id: newsArticles.id })

  await db
    .update(pendingArticles)
    .set({ status: "published" })
    .where(eq(pendingArticles.id, id))

  return published?.id ?? null
}

export async function ignorePendingArticle(id: number): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  await db.update(pendingArticles).set({ status: "ignored" }).where(eq(pendingArticles.id, id))
  return true
}

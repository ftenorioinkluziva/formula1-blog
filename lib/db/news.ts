import { asc, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newsArticles } from "@/lib/db/schema"
import { parseNewsDate } from "@/lib/db/news-date"

export interface NewsArticleItem {
  id: number
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  comments?: number
  author: string
  body: string[]
  image?: string
}

export interface NewsListPayload {
  featuredArticle: NewsArticleItem | null
  articles: NewsArticleItem[]
}

function toNewsArticleItem(row: typeof newsArticles.$inferSelect): NewsArticleItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    readTime: row.readTime,
    date: row.publishedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    comments: row.comments ?? undefined,
    author: row.author,
    body: row.body,
    image: row.imageUrl ?? undefined,
  }
}

export async function getNewsById(id: number): Promise<NewsArticleItem | null> {
  const db = getDb()

  if (!db) return null

  const rows = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.id, id))
    .limit(1)

  return rows[0] ? toNewsArticleItem(rows[0]) : null
}

export async function insertNews(news: Omit<NewsArticleItem, "id">): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const [row] = await db
    .insert(newsArticles)
    .values({
      title: news.title,
      excerpt: news.excerpt,
      category: news.category,
      readTime: news.readTime,
      publishedDate: parseNewsDate(news.date),
      comments: news.comments ?? null,
      author: news.author,
      body: news.body,
      imageUrl: news.image ?? null,
      isFeatured: false,
      sortOrder: 0,
    })
    .returning({ id: newsArticles.id })

  return row?.id ?? null
}

export async function getNewsList(): Promise<NewsListPayload> {
  const db = getDb()

  if (!db) {
    return {
      featuredArticle: null,
      articles: [],
    }
  }

  const [featuredRows, articleRows] = await Promise.all([
    db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.isFeatured, true))
      .orderBy(asc(newsArticles.sortOrder), asc(newsArticles.id))
      .limit(1),
    db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.isFeatured, false))
      .orderBy(asc(newsArticles.sortOrder), desc(newsArticles.id)),
  ])

  return {
    featuredArticle: featuredRows[0] ? toNewsArticleItem(featuredRows[0]) : null,
    articles: articleRows.map(toNewsArticleItem),
  }
}

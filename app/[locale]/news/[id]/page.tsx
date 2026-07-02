import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getNewsById } from "@/lib/db/news"
import { NewsArticleDetail } from "@/components/news-article-detail"
import { Navigation } from "@/components/navigation"

interface Props {
  params: Promise<{ locale: string; id: string }>
}

function parseArticleId(value: string): number | null {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) return null
  return numeric
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const articleId = parseArticleId(id)
  if (!articleId) return { title: "Article not found" }
  const article = await getNewsById(articleId)

  if (!article) {
    return { title: "Article not found" }
  }

  return {
    title: `${article.title} | F1 Paddock Insider`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.image ? [article.image] : [],
    },
  }
}

export default async function NewsArticlePage({ params }: Props) {
  const { locale, id } = await params
  const articleId = parseArticleId(id)
  if (!articleId) notFound()
  const article = await getNewsById(articleId)

  if (!article) {
    notFound()
  }

  return (
    <>
      <Navigation />
      <NewsArticleDetail article={article} locale={locale} />
    </>
  )
}

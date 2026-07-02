"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "@/lib/i18n/routing"
import { ChevronRight, Clock, MessageSquare, Bookmark } from "lucide-react"
import { useLocale } from "next-intl"
import type { NewsArticleItem } from "@/lib/db/news"

interface NewsApiResponse {
  featuredArticle: NewsArticleItem | null
  articles: NewsArticleItem[]
}

export function NewsSection() {
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticleItem | null>(null)
  const [articles, setArticles] = useState<NewsArticleItem[]>([])
  const locale = useLocale()
  const router = useRouter()

  useEffect(() => {
    async function loadNews() {
      try {
        const response = await fetch(`/${locale}/api/news`, { cache: "no-store" })

        if (!response.ok) {
          setFeaturedArticle(null)
          setArticles([])
          return
        }

        const data = (await response.json()) as NewsApiResponse
        setFeaturedArticle(data.featuredArticle)
        setArticles(data.articles)
      } catch {
        setFeaturedArticle(null)
        setArticles([])
      }
    }

    loadNews()
  }, [locale])

  function navigateToArticle(article: NewsArticleItem) {
    router.push(`/news/${article.id}`)
  }

  return (
    <section id="news" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/50" aria-labelledby="news-heading">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
              Latest Updates
            </span>
            <h2
              id="news-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
            >
              News
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            All News
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {featuredArticle && (
            <article
              className="lg:col-span-7 group cursor-pointer"
              onClick={() => navigateToArticle(featuredArticle)}
            >
              <div className="relative aspect-16/10 sm:aspect-16/10 rounded-sm overflow-hidden mb-3 sm:mb-4">
                <Image
                  src={featuredArticle.image ?? "/placeholder.svg?height=600&width=960"}
                  alt={featuredArticle.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
                <span className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2.5 sm:px-3 py-1 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-sm">
                  {featuredArticle.category}
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                  <h3 className="text-lg sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-foreground leading-tight mb-2 sm:mb-3 group-hover:text-primary transition-colors text-balance">
                    {featuredArticle.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-3 sm:mb-4 max-w-lg line-clamp-2 sm:line-clamp-none">
                    {featuredArticle.excerpt}
                  </p>
                  <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {featuredArticle.readTime}
                    </span>
                    <span>{featuredArticle.date}</span>
                    {featuredArticle.comments !== undefined && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {featuredArticle.comments}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Article list em grid responsivo */}
          <div className={`${featuredArticle ? "lg:col-span-5" : "lg:col-span-12"} grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4`}>
            {articles.map((article, i) => (
              <article
                key={article.title + i}
                className="group relative bg-card rounded-sm overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer flex flex-row items-stretch p-0"
                onClick={() => navigateToArticle(article)}
              >
                {/* Thumbnail — fixed aspect ratio, always visible */}
                <div className="relative w-24 sm:w-36 md:w-44 shrink-0 overflow-hidden bg-secondary">
                  <Image
                    src={article.image ?? "/placeholder.svg?height=200&width=360"}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 96px, (max-width: 768px) 144px, 176px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                {/* Info */}
                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-primary mb-1 block">
                      {article.category}
                    </span>
                    <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-3 sm:line-clamp-2 leading-snug">
                      {article.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-2">
                    <span>{article.date}</span>
                    <span className="hidden sm:inline">{article.readTime}</span>
                  </div>
                </div>
                <button
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hidden sm:block"
                  aria-label="Bookmark article"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

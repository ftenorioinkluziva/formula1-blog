"use client"

import { useEffect, useCallback, useState } from "react"
import { useLocale } from "next-intl"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight } from "lucide-react"
import type { NewsArticleItem } from "@/lib/db/news"

interface NewsApiResponse {
  featuredArticle: NewsArticleItem | null
  articles: NewsArticleItem[]
}

export function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [allArticles, setAllArticles] = useState<NewsArticleItem[]>([])
  const locale = useLocale()

  useEffect(() => {
    async function loadHeroData() {
      try {
        const response = await fetch(`/${locale}/api/news`, { cache: "no-store" })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as NewsApiResponse
        const articles = [data.featuredArticle, ...data.articles].filter(
          (item): item is NewsArticleItem => item !== null,
        )

        setAllArticles(articles.slice(0, 5))
        setCurrent(0)
      } catch {
        setAllArticles([])
      }
    }

    loadHeroData()
  }, [locale])

  const nextSlide = useCallback(() => {
    setCurrent((c) => (c + 1) % allArticles.length)
  }, [allArticles.length])

  useEffect(() => {
    if (allArticles.length <= 1) {
      return
    }

    const timer = setInterval(nextSlide, 10000)
    return () => clearInterval(timer)
  }, [nextSlide, allArticles.length])

  const featured = allArticles[current]
  const secondaryArticles = allArticles.slice(-4)

  if (!featured) {
    return null
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6" aria-label="Hero banner">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:gap-4">
        {/* Featured article carousel */}
        <div className="group relative block w-full aspect-video sm:aspect-2/1 lg:aspect-21/9 overflow-hidden rounded-sm">
          <Image
            src={featured.image ?? "/placeholder.svg?height=1080&width=1920"}
            alt={featured.title}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
            <span className="inline-block px-2.5 py-0.5 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-sm mb-2 sm:mb-3">
              {featured.category}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase leading-tight tracking-tight text-white max-w-3xl mb-4 sm:mb-5">
              {featured.title}
            </h1>

            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href={`/${locale}/news/${featured.id}`}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm uppercase tracking-widest rounded-sm hover:bg-primary/90 transition-colors"
              >
                Read Article
                <ChevronRight className="w-4 h-4" />
              </Link>

              {/* Slide indicators */}
              {allArticles.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {allArticles.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className={`h-1 rounded-full transition-all ${
                        i === current
                          ? "w-8 sm:w-10 bg-primary"
                          : "w-4 sm:w-5 bg-white/30 hover:bg-white/50"
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                  <span className="ml-2 text-[10px] sm:text-xs text-white/60 font-mono">
                    {String(current + 1).padStart(2, "0")} / {String(allArticles.length).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary articles grid */}
        {secondaryArticles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {secondaryArticles.map((article) => (
              <Link
                key={article.id}
                href={`/${locale}/news/${article.id}`}
                className="group flex items-stretch bg-card rounded-sm overflow-hidden border border-border hover:border-foreground/20 transition-colors"
              >
                <div className="relative w-28 sm:w-32 md:w-40 shrink-0 overflow-hidden">
                  <Image
                    src={article.image ?? "/placeholder.svg?height=200&width=300"}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 112px, (max-width: 768px) 128px, 160px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-center gap-1.5">
                  <span className="inline-block w-fit px-2 py-0.5 bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-sm">
                    {article.category}
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

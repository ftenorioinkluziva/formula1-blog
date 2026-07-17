"use client"

import { useEffect, useCallback, useState } from "react"
import { useLocale } from "next-intl"
import { Link } from "@/lib/i18n/routing"
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
  const [isPaused, setIsPaused] = useState(false)
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
    if (allArticles.length <= 1 || isPaused) {
      return
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const timer = setInterval(nextSlide, 10000)
    return () => clearInterval(timer)
  }, [nextSlide, allArticles.length, isPaused])

  const featured = allArticles[current]
  const secondaryArticles = allArticles.filter((article) => article.id !== featured?.id).slice(0, 4)

  if (!featured) {
    return null
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6" aria-label="Featured news">
      <div
        className="mx-auto grid max-w-7xl gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(22rem,1fr)] lg:gap-5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsPaused(false)
          }
        }}
      >
        <article className="group relative isolate min-h-105 overflow-hidden rounded-md bg-surface-deep sm:min-h-120 lg:min-h-135">
          <Image
            src={featured.image ?? "/placeholder.svg?height=1080&width=1920"}
            alt={featured.title}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 65vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 -z-10 bg-surface-deep" />
          <div className="absolute inset-0 bg-linear-to-t from-player-background via-player-background/55 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
            <span className="mb-3 inline-flex bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground sm:text-xs">
              {featured.category}
            </span>
            <h1 className="max-w-3xl text-3xl font-black uppercase leading-[0.98] tracking-tight text-player-foreground sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {featured.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link
                href={`/news/${featured.id}`}
                className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5 sm:text-sm"
              >
                Read Article
                <ChevronRight className="h-4 w-4" />
              </Link>

              {allArticles.length > 1 && (
                <div className="flex items-center gap-1.5" aria-label="Featured news slides">
                  {allArticles.map((article, i) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`min-h-0 min-w-0 rounded-full transition-all duration-300 ${
                        i === current
                          ? "h-1.5 w-9 bg-primary sm:w-10"
                          : "h-1.5 w-4 bg-player-foreground/35 hover:bg-player-foreground/60 sm:w-5"
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === current ? "true" : undefined}
                    />
                  ))}
                  <span className="ml-2 text-[10px] font-mono text-player-foreground/60 sm:text-xs">
                    {String(current + 1).padStart(2, "0")} / {String(allArticles.length).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </article>

        {secondaryArticles.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-2 lg:gap-x-4 lg:gap-y-8">
            {secondaryArticles.map((article) => (
              <Link
                key={article.id}
                href={`/news/${article.id}`}
                className="group block min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="relative aspect-[1.55/1] overflow-hidden rounded-md bg-surface-raised">
                  <Image
                    src={article.image ?? "/placeholder.svg?height=360&width=560"}
                    alt={article.title}
                    fill
                    sizes="(max-width: 639px) 45vw, (max-width: 1023px) 22vw, 18vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>
                <div className="pt-2.5 sm:pt-3">
                  <span className="mb-1.5 inline-flex bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary-foreground sm:text-[10px]">
                    {article.category}
                  </span>
                  <h2 className="line-clamp-3 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-base">
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

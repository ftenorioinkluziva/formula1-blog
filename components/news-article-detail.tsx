"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import {
  Clock,
  MessageSquare,
  User,
  ChevronLeft,
  Check,
  Copy,
} from "lucide-react"
import type { NewsArticleItem } from "@/lib/db/news"

interface ShareButtonsProps {
  title: string
  url: string
}

function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(title)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">
        Share
      </span>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-brand-whatsapp text-player-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-brand-whatsapp/90 transition-colors"
        aria-label="Share on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp
      </a>

      {/* Telegram */}
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-brand-telegram text-player-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-brand-telegram/90 transition-colors"
        aria-label="Share on Telegram"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        Telegram
      </a>

      {/* Copy Link */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        aria-label="Copy link"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  )
}

interface NewsArticleDetailProps {
  article: NewsArticleItem
  locale: string
}

export function NewsArticleDetail({ article, locale }: NewsArticleDetailProps) {
  const articleUrl = `https://f1paddockinsider.com/${locale}/news/${article.id}`

  return (
    <main className="min-h-screen bg-background pt-16">
      {/* Hero image */}
      <div className="relative w-full h-[42vh] min-h-[280px] max-h-[60vh] overflow-hidden">
        <Image
          src={article.image ?? "/placeholder.svg?height=720&width=1280"}
          alt={article.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />

        {/* Category badge overlaid on image */}
        <div className="absolute bottom-6 left-4 sm:left-8 lg:left-16">
          <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm">
            {article.category}
          </span>
        </div>
      </div>

      {/* Article body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors font-bold uppercase tracking-wider"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to Home
          </Link>
        </nav>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground mb-4 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.readTime}
          </span>
          <span>{article.date}</span>
          {article.comments !== undefined && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {article.comments} comments
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground leading-tight mb-6">
          {article.title}
        </h1>

        {/* Author bar + share */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-sm bg-secondary flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">{article.author}</p>
              <p className="text-[10px] text-muted-foreground">Staff Writer</p>
            </div>
          </div>

          <ShareButtons title={article.title} url={articleUrl} />
        </div>

        {/* Excerpt */}
        <p className="text-base sm:text-lg text-foreground font-medium leading-relaxed mb-8 border-l-2 border-primary pl-4">
          {article.excerpt}
        </p>

        {/* Body paragraphs */}
        <div className="flex flex-col gap-5">
          {article.body.map((paragraph, i) => (
            <div
              key={i}
              className="prose prose-sm sm:prose-base prose-invert max-w-none text-zinc-300 leading-relaxed"
            >
              <ReactMarkdown>{paragraph}</ReactMarkdown>
            </div>
          ))}
        </div>

        {/* Comments footer */}
        {article.comments !== undefined && (
          <div className="mt-10 pt-6 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="w-4 h-4" />
            <span>
              <strong className="text-foreground">{article.comments}</strong>{" "}
              comments on this article
            </span>
          </div>
        )}

        {/* Bottom share strip */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Enjoyed this article? Share it:
          </p>
          <ShareButtons title={article.title} url={articleUrl} />
        </div>

        {/* Back link */}
        <div className="mt-10">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to all news
          </Link>
        </div>
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from "lucide-react"

interface GalleryImage {
  id: number
  imageUrl: string
  caption: string | null
  sortOrder: number
}

interface GalleryViewerProps {
  galleryId: number
  galleryTitle: string
  galleryCategory: string
  locale: string
  onClose: () => void
}

export function GalleryViewer({
  galleryId,
  galleryTitle,
  galleryCategory,
  locale,
  onClose,
}: GalleryViewerProps) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/${locale}/api/gallery/${galleryId}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error("Não foi possível carregar esta galeria.")
        }

        const data = (await res.json()) as { images: GalleryImage[] }
        setImages(data.images ?? [])
        setActiveIndex(0)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        setImages([])
        setError(err instanceof Error ? err.message : "Não foi possível carregar esta galeria.")
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => controller.abort()
  }, [galleryId, locale, reloadKey])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [])

  const prev = useCallback(() => {
    if (images.length <= 1) {
      return
    }

    setActiveIndex((i) => (i - 1 + images.length) % images.length)
  }, [images.length])

  const next = useCallback(() => {
    if (images.length <= 1) {
      return
    }

    setActiveIndex((i) => (i + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        prev()
      }

      if (e.key === "ArrowRight") {
        e.preventDefault()
        next()
      }

      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        const items = Array.from(focusable ?? []).filter((item) => !item.hasAttribute("aria-hidden"))

        if (items.length === 0) {
          e.preventDefault()
          return
        }

        const first = items[0]
        const last = items[items.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, prev, next])

  const activeImage = images[activeIndex]
  const canNavigate = images.length > 1

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-background flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-viewer-title"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary shrink-0">
            {galleryCategory}
          </span>
          <h2
            id="gallery-viewer-title"
            className="text-sm sm:text-base font-bold text-foreground uppercase tracking-tight truncate"
            title={galleryTitle}
          >
            {galleryTitle}
          </h2>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {images.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </span>
          )}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Fechar galeria"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 bg-background/30">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs uppercase tracking-widest">Loading gallery</span>
          </div>
        ) : error ? (
          <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center text-muted-foreground" role="alert">
            <ImageIcon className="w-12 h-12 opacity-30" />
            <div>
              <p className="text-sm font-semibold text-foreground">Galeria indisponível</p>
              <p className="mt-1 text-xs leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="rounded-sm border border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Tentar novamente
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ImageIcon className="w-12 h-12 opacity-30" />
            <span className="text-xs uppercase tracking-widest">No images yet</span>
          </div>
        ) : (
          <>
            {/* Prev button */}
            <button
              onClick={prev}
              disabled={!canNavigate}
              className="absolute left-3 sm:left-6 z-10 p-3 rounded-sm bg-background/70 border border-border backdrop-blur-sm hover:bg-background transition-colors text-foreground disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Image */}
            <div className="relative h-full flex-1 mx-16 sm:mx-24 my-4">
              <Image
                key={activeImage.id}
                src={activeImage.imageUrl}
                alt={activeImage.caption ?? galleryTitle}
                fill
                sizes="100vw"
                className="object-contain rounded-sm"
              />
            </div>

            {/* Next button */}
            <button
              onClick={next}
              disabled={!canNavigate}
              className="absolute right-3 sm:right-6 z-10 p-3 rounded-sm bg-background/70 border border-border backdrop-blur-sm hover:bg-background transition-colors text-foreground disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}
      </div>

      {/* Caption + thumbnail strip */}
      {!loading && images.length > 0 && (
        <div className="shrink-0 border-t border-border">
          {/* Caption */}
          {activeImage?.caption && (
            <p className="px-4 sm:px-6 pt-3 pb-2 text-xs text-muted-foreground text-center">
              {activeImage.caption}
            </p>
          )}

          {/* Thumbnail strip */}
          <div className="flex gap-1.5 sm:gap-2 px-4 sm:px-6 py-3 overflow-x-auto no-scrollbar">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(i)}
                className={`relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-sm overflow-hidden border-2 transition-all ${
                  i === activeIndex
                    ? "border-primary opacity-100"
                    : "border-transparent opacity-40 hover:opacity-70"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
                aria-current={i === activeIndex ? "true" : undefined}
                aria-label={`Ver imagem ${i + 1}`}
              >
                <Image
                  src={img.imageUrl}
                  alt={img.caption ?? `Imagem ${i + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

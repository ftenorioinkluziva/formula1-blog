"use client"

import { useEffect, useState, type ReactElement } from "react"
import { MapPin, Flag, ChevronRight, Clock3 } from "lucide-react"
import { useLocale } from "next-intl"
import { shouldPollLiveTiming } from "@/lib/live-timing/api"

type BannerKind = "live" | "next"

interface SessionInfo {
  name: string
  circuit: string
  country: string
  type: string
  part: number | null
  startTimeUtc: string
}

interface SessionBannerPayload {
  kind: BannerKind
  session: SessionInfo
}

interface SessionBannerApiResponse {
  banner: SessionBannerPayload | null
}

function buildSessionTypeLabel(type: string, part: number | null): string {
  if (!part) {
    return type
  }

  const partText = String(part)
  const partAlreadyInType = new RegExp(`\\b${partText}\\b`).test(type)

  if (partAlreadyInType) {
    return type
  }

  return `${type} ${partText}`
}

export function SessionBanner(): ReactElement | null {
  const [banner, setBanner] = useState<SessionBannerPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const locale = useLocale()
  const isLive = banner?.kind === "live"
  const session = banner?.session ?? null

  function getSessionRoute(sessionType: string): string {
    const type = sessionType.toLowerCase()

    if (type === "race" || type === "sprint") {
      return `/${locale}/live-timing/race`
    }

    if (type.includes("practice")) {
      return `/${locale}/live-timing/practice`
    }

    if (type.includes("qualifying")) {
      return `/${locale}/live-timing/qualifying`
    }

    return `/${locale}/live-timing`
  }

  function formatStartTime(utcIso: string): string {
    const localeMap: Record<string, string> = {
      pt: "pt-BR",
      en: "en-US",
      es: "es-ES",
    }

    return new Intl.DateTimeFormat(localeMap[locale] ?? "en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(utcIso))
  }

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let checkInterval: ReturnType<typeof setInterval> | null = null
    let currentPollMs = 30 * 1000 // default: 30s

    async function checkSession() {
      try {
        const response = await fetch(`/${locale}/api/session-banner`, {
          cache: "no-store",
        })

        if (!response.ok) {
          setBanner(null)
          setLoading(false)
          return
        }

        const data = (await response.json()) as SessionBannerApiResponse
        setBanner(data.banner)
        setLoading(false)

        // Adjust polling interval based on banner kind
        const isActive = data.banner?.kind === "live"
        const nextInterval = isActive ? 30 * 1000 : 5 * 60 * 1000 // 30s if live, 5min otherwise
        
        // If interval changed, restart the polling timer
        if (nextInterval !== currentPollMs && pollInterval) {
          currentPollMs = nextInterval
          clearInterval(pollInterval)
          pollInterval = setInterval(checkSession, currentPollMs)
        }
      } catch {
        setBanner(null)
        setLoading(false)
      }
    }

    async function ensurePolling() {
      const shouldPoll = await shouldPollLiveTiming()
      
      if (!shouldPoll) {
        // No session within 1 hour — stop polling
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
        return
      }

      // Session within 1 hour — start or continue polling
      if (!pollInterval) {
        await checkSession()
        pollInterval = setInterval(checkSession, currentPollMs)
      }
    }

    // Initial check
    ensurePolling()

    // Re-check every 5 minutes if polling should be active
    checkInterval = setInterval(ensurePolling, 5 * 60 * 1000)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [locale])

  if (loading) {
    return null
  }

  if (!session || !banner) {
    return null
  }

  const sessionRoute = getSessionRoute(session.type)
  const nextSessionLabel = formatStartTime(session.startTimeUtc)
  const sessionTypeLabel = buildSessionTypeLabel(session.type, session.part)
  const timeLabel = isLive ? "Agora" : nextSessionLabel
  const wrapperToneClass = isLive
    ? "border-red-500/25 bg-linear-to-r from-red-950/40 via-red-900/25 to-red-950/40 hover:border-red-400/45"
    : "border-amber-500/25 bg-linear-to-r from-zinc-950/85 via-zinc-900/65 to-red-950/30 hover:border-amber-400/45"
  const statusToneClass = isLive
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-amber-400/35 bg-amber-500/10 text-amber-200"
  const dotToneClass = isLive
    ? "bg-red-500 animate-pulse shadow-sm shadow-red-500/50"
    : "bg-amber-300"
  const metaToneClass = isLive ? "text-zinc-300" : "text-zinc-400"
  const leadMetaToneClass = isLive ? "text-zinc-200" : "text-zinc-300"
  const ctaToneClass = isLive
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-amber-400/35 bg-amber-500/10 text-amber-200"

  const handleOpen = () => {
    if (!isLive) {
      window.location.assign(`/${locale}#schedule`)
      return
    }

    const width = window.screen.availWidth
    const height = window.screen.availHeight

    window.open(sessionRoute, "F1LiveTiming", `width=${width},height=${height},left=0,top=0,toolbar=no,location=no,menubar=no,status=no`)
  }

  return (
    <div className={`sticky top-14 z-40 mt-14 w-full border-b antialiased transition-all sm:top-16 sm:mt-16 ${wrapperToneClass}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={handleOpen}
          className="grid min-h-12 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-2.5 text-left transition-opacity hover:opacity-90 xl:gap-x-3"
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5 xl:gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] shrink-0 ${statusToneClass}`}>
                <span className={`h-2 w-2 rounded-full ${dotToneClass}`} />
                {isLive ? "Ao vivo" : "Próxima"}
              </span>

              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[0.01em] text-zinc-50 xl:text-[15px]">
                {session.name}
              </h3>
            </div>

            <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium sm:text-xs xl:gap-x-3 ${metaToneClass}`}>
              <span className={`inline-flex items-center gap-1.5 ${leadMetaToneClass}`}>
                <Flag className="w-3 h-3" />
                <span className="uppercase tracking-[0.08em]">{sessionTypeLabel}</span>
              </span>

              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-32 lg:max-w-40 xl:max-w-52">{session.circuit}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock3 className="w-3 h-3" />
                <span>{timeLabel}</span>
              </span>

              <span className="hidden items-center text-zinc-500/80 xl:inline">•</span>

              <span className="hidden truncate text-zinc-400/90 xl:inline">{session.country}</span>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors sm:px-2.5 sm:text-xs ${ctaToneClass}`}>
            <span className="hidden sm:inline lg:hidden xl:inline">{isLive ? "Assistir" : "Ver agenda"}</span>
            <span className="hidden lg:inline xl:hidden">{isLive ? "Live" : "Agenda"}</span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  )
}

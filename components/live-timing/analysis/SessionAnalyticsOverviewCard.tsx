"use client"

import { useEffect, useMemo, useState } from "react"
import type { CurrentSessionAnalyticsApiPayload } from "@/components/live-timing/analysis/session-analytics-types"

function getLocalizedApiPath(): string {
  if (typeof window === "undefined") return "/api/session-analytics/current"

  const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0]

  if (firstPathSegment && ["pt", "en", "es"].includes(firstPathSegment)) {
    return `/${firstPathSegment}/api/session-analytics/current`
  }

  return "/api/session-analytics/current"
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
}

interface SessionAnalyticsOverviewCardProps {
  payload?: CurrentSessionAnalyticsApiPayload | null
  loading?: boolean
}

export function SessionAnalyticsOverviewCard({
  payload: externalPayload,
  loading: externalLoading,
}: SessionAnalyticsOverviewCardProps = {}) {
  const shouldFetchInternally = externalPayload === undefined && externalLoading === undefined
  const [loading, setLoading] = useState(shouldFetchInternally)
  const [payload, setPayload] = useState<CurrentSessionAnalyticsApiPayload | null>(null)

  useEffect(() => {
    if (!shouldFetchInternally) {
      return
    }

    let active = true

    const load = async () => {
      try {
        const response = await fetch(getLocalizedApiPath(), {
          method: "GET",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        })

        const json = (await response.json()) as CurrentSessionAnalyticsApiPayload

        if (active) {
          setPayload(json)
          setLoading(false)
        }
      } catch {
        if (active) {
          setPayload({ sessionId: null, overview: null, error: "Falha ao carregar visão da sessão" })
          setLoading(false)
        }
      }
    }

    void load()
    const interval = setInterval(() => {
      void load()
    }, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [shouldFetchInternally])

  const effectivePayload = shouldFetchInternally ? payload : externalPayload ?? null
  const effectiveLoading = shouldFetchInternally ? loading : externalLoading ?? false

  const latestMessage = useMemo(() => effectivePayload?.overview?.latestRaceControlMessage ?? null, [effectivePayload])

  if (effectiveLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-2/3 mb-3" />
        <div className="h-6 bg-secondary rounded w-1/2 mb-2" />
        <div className="h-4 bg-secondary rounded w-3/4" />
      </div>
    )
  }

  if (!effectivePayload?.overview) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-foreground font-bold mb-2 text-sm">Resumo da Sessão</h3>
        <p className="text-muted-foreground/80 text-sm">{effectivePayload?.message || effectivePayload?.error || "Sem dados agregados"}</p>
      </div>
    )
  }

  const overview = effectivePayload.overview
  const recentStatus = overview.recentStatusTimeline ?? []
  const recentRaceControl = overview.recentRaceControlMessages ?? []

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-foreground font-bold mb-3 text-sm">Resumo da Sessão</h3>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/80">Sessão</span>
          <span className="text-foreground font-semibold">#{overview.sessionId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/80">Status</span>
          <span className="text-foreground font-semibold">{overview.latestStatus || "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/80">Eventos de status</span>
          <span className="text-foreground font-semibold tabular-nums">{overview.statusEvents}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/80">Mensagens RC</span>
          <span className="text-foreground font-semibold tabular-nums">{overview.raceControlMessages}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/80">Voltas registradas</span>
          <span className="text-foreground font-semibold tabular-nums">{overview.completedLaps}</span>
        </div>
      </div>

      {latestMessage ? (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          Última RC: <span className="text-foreground font-semibold">{latestMessage.messageType}</span> — {truncateText(latestMessage.messageText, 72)}
        </div>
      ) : null}

      {recentStatus.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80 mb-2">Timeline de Status</p>
          <div className="space-y-1.5">
            {recentStatus.map((item) => (
              <div key={`status-${item.occurredAtUtc}-${item.status}`} className="text-xs text-foreground/80 leading-tight">
                <span className="text-foreground font-medium">{item.status}</span>
                {item.reason ? <span className="text-muted-foreground"> — {truncateText(item.reason, 52)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentRaceControl.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80 mb-2">Direção de Prova (recente)</p>
          <div className="space-y-1.5">
            {recentRaceControl.map((item) => (
              <div key={`rc-${item.occurredAtUtc}-${item.messageType}-${item.messageText}`} className="text-xs text-foreground/80 leading-tight">
                <span className="text-foreground font-medium">{item.messageType}</span>
                <span className="text-muted-foreground"> — {truncateText(item.messageText, 70)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

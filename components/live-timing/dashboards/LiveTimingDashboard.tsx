"use client"

import { useEffect, useState } from "react"

import {
  LiveTimingProvider,
  TimingTable,
  SessionCompactHeader,
  TeamRadioList,
  ConnectionStatus,
  PitStopTimeline,
  SessionAnalyticsOverviewCard,
  useLiveTiming,
} from "@/components/live-timing"
import type { CurrentSessionAnalyticsApiPayload } from "@/components/live-timing/analysis/session-analytics-types"

export default function LiveTimingDashboard() {
  return (
    <LiveTimingProvider>
      <div className="min-h-screen bg-background pt-20 pb-8">
        <div className="max-w-400 mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <SessionCompactHeader />
              <TimingTable />
            </div>
            <div className="lg:col-span-3 space-y-4">  
              <SelectedDriverStrategy />
              <TeamRadioList />
            </div>
          </div>
        </div>
      </div>
    </LiveTimingProvider>
  )
}

function SelectedDriverStrategy() {
  const { selectedDriverNumber } = useLiveTiming()

  if (!selectedDriverNumber) {
    return null
  }

  return <PitStopTimeline racingNumber={selectedDriverNumber} />
}

function getLocalizedSessionAnalyticsPath(): string {
  if (typeof window === "undefined") {
    return "/api/session-analytics/current"
  }

  const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0]

  if (firstPathSegment && ["pt", "en", "es"].includes(firstPathSegment)) {
    return `/${firstPathSegment}/api/session-analytics/current`
  }

  return "/api/session-analytics/current"
}

function SessionAnalyticsCards() {
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<CurrentSessionAnalyticsApiPayload | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const response = await fetch(getLocalizedSessionAnalyticsPath(), {
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
  }, [])

  return <SessionAnalyticsOverviewCard payload={payload} loading={loading} />
}

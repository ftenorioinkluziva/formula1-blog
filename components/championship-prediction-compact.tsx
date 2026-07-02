"use client"

import { useEffect, useState } from "react"
import { fetchLiveTiming } from "@/lib/live-timing/api"
import { useI18n } from "@/lib/i18n/client"
import { parseChampionshipPrediction } from "@/lib/live-timing/parsers"
import type { ChampionshipPredictionEntry, F1LiveTimingRawState } from "@/lib/live-timing/types"

const POLLING_MS = 8000

function isRaceSession(raw: Pick<F1LiveTimingRawState, "SessionInfo" | "SessionStatus"> | null | undefined): boolean {
  const type = String(raw?.SessionInfo?.Type || raw?.SessionInfo?.Name || "").toLowerCase()
  const status = String(raw?.SessionStatus?.Status || "").toLowerCase()

  const isRaceType = type.includes("race") || type.includes("sprint")
  const isLiveStatus = status === "started"

  return isRaceType && isLiveStatus
}

export function ChampionshipPredictionCompact() {
  const { t } = useI18n()
  const [entries, setEntries] = useState<ChampionshipPredictionEntry[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      const raw = await fetchLiveTiming()
      if (!raw || !mounted) return

      const shouldShow = isRaceSession(raw)
      if (!shouldShow) {
        setVisible(false)
        setEntries([])
        return
      }

      const parsed = parseChampionshipPrediction(raw)
      if (parsed.length === 0) {
        setVisible(false)
        setEntries([])
        return
      }

      setVisible(true)
      setEntries(parsed.slice(0, 6))
    }

    load()
    const id = setInterval(load, POLLING_MS)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  if (!visible || entries.length === 0) {
    return null
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto rounded-xl border border-border bg-secondary/30 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground/80">
            {t("liveTiming.championshipPredictionCompact.titleLive")}
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {entries.map((entry) => (
            <div
              key={entry.racingNumber}
              className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold" style={{ color: `#${entry.teamColour}` }}>
                  {entry.tla}
                </span>

                <span className="text-[10px] text-muted-foreground">
                  {entry.currentPoints} {t("liveTiming.championshipPredictionCompact.currentToPrediction")}
                </span>

                <span className="text-[10px] text-green-400">
                  {entry.predictedPoints} {t("liveTiming.championshipPredictionCompact.pointsSuffix")}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Δ {entry.deltaPoints > 0 ? `+${entry.deltaPoints}` : entry.deltaPoints}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

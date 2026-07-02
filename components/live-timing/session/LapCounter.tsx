"use client"

import { useLiveTiming } from "../LiveTimingProvider"

export function LapCounter() {
  const { lapCount } = useLiveTiming()

  if (!lapCount || lapCount.totalLaps === 0) {
    return null
  }

  return (
    <div className="bg-card border border-border rounded-xl px-6 py-3">
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Lap
        </span>
        <span className="text-2xl font-bold text-foreground tabular-nums">
          {lapCount.currentLap}
        </span>
        <span className="text-lg text-muted-foreground/80">/</span>
        <span className="text-lg font-semibold text-foreground/80 tabular-nums">
          {lapCount.totalLaps}
        </span>
      </div>
    </div>
  )
}

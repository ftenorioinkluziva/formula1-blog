"use client"

import { useLiveTiming } from "../LiveTimingProvider"
import { formatLapTime, parseLapTimeToMs } from "@/lib/live-timing/formatters"
import { Trophy, Timer, Gauge } from "lucide-react"

export function TimingStatsCard() {
  const { timingStats, driverInfoMap } = useLiveTiming()

  if (!timingStats) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Session Stats
        </h3>
        <p className="text-sm text-muted-foreground/80">No data available</p>
      </div>
    )
  }

  const bestLapDriverInfo = driverInfoMap[timingStats.bestLapDriver]
  const topSpeedDriverInfo = driverInfoMap[timingStats.topSpeedDriver]
  const idealLapValues = [
    timingStats.bestSectors.sector1,
    timingStats.bestSectors.sector2,
    timingStats.bestSectors.sector3,
  ].map((value) => parseLapTimeToMs(value))
  const idealLapMs = idealLapValues.some((value) => value === null)
    ? null
    : idealLapValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const idealLap = idealLapMs ? formatLapTime(idealLapMs) : "—"

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4" />
        Session Best
      </h3>

      <div className="space-y-4">
        {/* Best Lap Time */}
        <div className="bg-background rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Ideal Lap
              </span>
            </div>
            <span className="text-xs text-muted-foreground/80">
              {bestLapDriverInfo?.fullName || timingStats.bestLapDriver}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {idealLap}
          </div>
        </div>

        {/* Best Sectors */}
        <div className="bg-background rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Best Sectors
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-muted-foreground/80 mb-1">S1</div>
              <div className="text-sm font-bold text-green-400 tabular-nums">
                {timingStats.bestSectors.sector1}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground/80 mb-1">S2</div>
              <div className="text-sm font-bold text-green-400 tabular-nums">
                {timingStats.bestSectors.sector2}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground/80 mb-1">S3</div>
              <div className="text-sm font-bold text-green-400 tabular-nums">
                {timingStats.bestSectors.sector3}
              </div>
            </div>
          </div>
        </div>

        {/* Top Speed */}
        <div className="bg-background rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Top Speed
              </span>
            </div>
            <span className="text-xs text-muted-foreground/80">
              {topSpeedDriverInfo?.fullName || timingStats.topSpeedDriver}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {timingStats.topSpeed}
            </span>
            <span className="text-sm text-muted-foreground">km/h</span>
          </div>
        </div>
      </div>
    </div>
  )
}

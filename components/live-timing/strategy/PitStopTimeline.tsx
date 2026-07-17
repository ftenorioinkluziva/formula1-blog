"use client"

import { useLiveTiming } from "../LiveTimingProvider"
import { parseDriverStints } from "@/lib/live-timing/parsers"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
import { useEffect, useState } from "react"
import { COMPOUND_COLORS, COMPOUND_SHORT } from "@/lib/live-timing/constants"
import type { DriverStints } from "@/lib/live-timing/types"

interface Props {
  racingNumber?: string
}

export function PitStopTimeline({ racingNumber }: Props) {
  const { selectedDriverNumber, driverInfoMap, lapCount } = useLiveTiming()
  const [stints, setStints] = useState<DriverStints | null>(null)

  const targetDriver = racingNumber || selectedDriverNumber

  useEffect(() => {
    function loadStints(rawState: Parameters<typeof parseDriverStints>[0]) {
      const allStints = parseDriverStints(rawState)
      const driverStints = allStints.find((s) => s.racingNumber === targetDriver)
      setStints(driverStints || null)
    }

    return subscribeLiveTiming(loadStints, 5000)
  }, [targetDriver])

  if (!targetDriver || !stints || stints.stints.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Tire Strategy
        </h3>
        <p className="text-sm text-muted-foreground/80">No data available</p>
      </div>
    )
  }

  const driverInfo = driverInfoMap[targetDriver]
  const totalLaps = lapCount?.totalLaps || 100

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Tire Strategy
      </h3>
      <p className="text-xs text-muted-foreground/80 mb-4">
        {driverInfo?.fullName || targetDriver}
      </p>

      <div className="space-y-3">
        {stints.stints.map((stint, index) => {
          const compound = stint.compound || "UNKNOWN"
          const color = COMPOUND_COLORS[compound] || "var(--muted-foreground)"
          const short = COMPOUND_SHORT[compound] || compound.substring(0, 1)
          const endLap = stint.startLap + stint.totalLaps - 1
          const widthPercent = (stint.totalLaps / totalLaps) * 100

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Stint {index + 1}
                </span>
                <span className="text-muted-foreground/80 tabular-nums">
                  Laps {stint.startLap}-{endLap} ({stint.totalLaps} laps)
                </span>
              </div>
              
              <div className="relative h-8 bg-background rounded overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center justify-center transition-all"
                  style={{
                    width: `${Math.max(widthPercent, 10)}%`,
                    backgroundColor: color,
                  }}
                >
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-foreground">
                      {short}
                    </span>
                    {stint.isNew && (
                      <span className="text-[10px] font-medium bg-foreground text-background px-1.5 rounded">
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/80">Total pit stops</span>
          <span className="text-foreground font-semibold">{stints.stints.length - 1}</span>
        </div>
      </div>
    </div>
  )
}

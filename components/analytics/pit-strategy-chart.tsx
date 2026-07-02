"use client"

import { useEffect, useState } from "react"
import type { PitStrategyResponse } from "@/lib/analytics/types"

interface Props {
  season: number
  round: number
  locale: string
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "var(--tire-soft)",
  MEDIUM: "var(--tire-medium)",
  HARD: "var(--tire-hard)",
  INTERMEDIATE: "var(--tire-intermediate)",
  WET: "var(--tire-wet)",
  UNKNOWN: "var(--tire-unknown)",
}

const FALLBACK_STINT_COLORS = [
  "var(--stint-fallback-1)",
  "var(--stint-fallback-2)",
  "var(--stint-fallback-3)",
  "var(--stint-fallback-4)",
  "var(--stint-fallback-5)",
  "var(--stint-fallback-6)",
]

function getStintColor(compound: string | null, stintIndex: number): string {
  if (compound) {
    return COMPOUND_COLORS[compound.toUpperCase()] ?? FALLBACK_STINT_COLORS[stintIndex % FALLBACK_STINT_COLORS.length]
  }
  return FALLBACK_STINT_COLORS[stintIndex % FALLBACK_STINT_COLORS.length]
}

function getStintLabel(compound: string | null, laps: number): string {
  if (laps < 4) return ""
  const compoundChar = compound ? compound.charAt(0).toUpperCase() : ""
  return compoundChar ? `${compoundChar}${laps}` : `${laps}L`
}

export function PitStrategyChart({ season, round, locale }: Props) {
  const [data, setData] = useState<PitStrategyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/pit-strategy?season=${season}&round=${round}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, round, locale])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading strategy data...</div>
  }

  if (!data || !data.drivers.length) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No pit strategy data available</div>
  }

  const totalLaps = data.totalLaps
  const hasAnyStops = data.drivers.some((d) => d.stops.length > 0)
  const hasAnyStints = data.drivers.some((d) => d.stints.length > 0)

  if (!hasAnyStops && !hasAnyStints) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground/80">
        No pit stop data available for this race. Pit stop data may not have been synced yet.
      </div>
    )
  }

  const hasCompoundData = data.drivers.some((d) => d.stints.some((s) => s.compound !== null))

  const strategyGroups = new Map<string, number>()
  for (const d of data.drivers) {
    const key = hasCompoundData
      ? d.stints.map((s) => s.compound?.charAt(0).toUpperCase() ?? "?").join("-")
      : `${d.stops.length}-stop`
    strategyGroups.set(key, (strategyGroups.get(key) ?? 0) + 1)
  }

  const usedCompounds = new Set<string>()
  if (hasCompoundData) {
    for (const d of data.drivers) {
      for (const s of d.stints) {
        if (s.compound) usedCompounds.add(s.compound.toUpperCase())
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Array.from(strategyGroups.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([strategy, count]) => (
            <span key={strategy} className="bg-secondary px-2 py-1 rounded">
              {strategy}: {count} driver{count > 1 ? "s" : ""}
            </span>
          ))}
      </div>

      <div className="space-y-1">
        {data.drivers.map((driver) => {
          const hasStops = driver.stops.length > 0
          const hasStints = driver.stints.length > 0
          const pitLabel = hasStops ? `${driver.stops.length}s` : hasStints ? `${driver.stints.length}st` : ""
          return (
            <div key={driver.driverId} className="flex items-center gap-2 h-8 group">
              <span className="w-24 text-xs text-muted-foreground text-right shrink-0 truncate">
                P{driver.finishPosition} {driver.driverCode}
                {pitLabel && <span className="text-muted-foreground/60 ml-1">({pitLabel})</span>}
              </span>
              <div className="flex-1 relative h-6 bg-card rounded overflow-hidden">
                {hasStints || hasStops ? (
                  <>
                    {driver.stints.map((stint, i) => {
                      const left = ((stint.startLap - 1) / totalLaps) * 100
                      const width = (stint.laps / totalLaps) * 100
                      const color = getStintColor(stint.compound, i)
                      const isLight = stint.compound?.toUpperCase() === "HARD"
                      return (
                        <div
                          key={i}
                          className={`absolute top-0 h-full rounded-sm flex items-center justify-center text-[10px] font-medium cursor-default ${isLight ? "text-background/80" : "text-foreground/90"}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: color,
                            opacity: 0.75,
                          }}
                          title={`Stint ${i + 1}: Laps ${stint.startLap}–${stint.endLap} (${stint.laps} laps)${stint.compound ? ` — ${stint.compound}` : ""}`}
                        >
                          {getStintLabel(stint.compound, stint.laps)}
                        </div>
                      )
                    })}
                    {driver.stops.map((stop) => (
                      <div
                        key={stop.stopNumber}
                        className="absolute top-0 h-full w-0.5 bg-foreground/80"
                        style={{ left: `${((stop.lap - 0.5) / totalLaps) * 100}%` }}
                        title={`Stop ${stop.stopNumber} — Lap ${stop.lap}${stop.durationMs ? ` — ${(stop.durationMs / 1000).toFixed(1)}s` : ""}`}
                      />
                    ))}
                  </>
                ) : (
                  <div
                    className="absolute top-0 h-full rounded-sm flex items-center justify-center text-[10px] text-muted-foreground/80"
                    style={{ left: 0, width: "100%", backgroundColor: "var(--secondary)", opacity: 0.5 }}
                  >
                    No pit data
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pl-26 pr-0">
        <span className="pl-24">Lap 1</span>
        <span>Lap {Math.round(totalLaps / 2)}</span>
        <span>Lap {totalLaps}</span>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
        {hasCompoundData ? (
          <>
            {Array.from(usedCompounds).map((compound) => (
              <span key={compound} className="flex items-center gap-1">
                <span
                  className="w-3 h-2 rounded-sm"
                  style={{ backgroundColor: COMPOUND_COLORS[compound] ?? "var(--muted-foreground)", opacity: 0.75 }}
                />
                {compound.charAt(0) + compound.slice(1).toLowerCase()}
              </span>
            ))}
          </>
        ) : (
          FALLBACK_STINT_COLORS.slice(0, Math.min(5, Math.max(...data.drivers.map((d) => d.stints.length), 1))).map((color, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.75 }} />
              Stint {i + 1}
            </span>
          ))
        )}
        <span className="flex items-center gap-1">
          <span className="w-0.5 h-3 bg-foreground/80" />
          Pit stop
        </span>
        {hasCompoundData && (
          <span className="text-muted-foreground/60 text-[10px]">(X##) = compound + lap count</span>
        )}
        {!hasCompoundData && (
          <span className="text-muted-foreground/60 text-[10px]">(NL) = stint lap count</span>
        )}
      </div>

      {!hasCompoundData && (
        <p className="text-[10px] text-muted-foreground/60">
          Tire compound data requires OpenF1 sync (available from 2023+). Run sync with round number to fetch compounds.
        </p>
      )}
    </div>
  )
}

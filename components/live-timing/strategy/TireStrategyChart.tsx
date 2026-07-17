"use client"

import { useLiveTiming } from "../LiveTimingProvider"
import { parseDriverStints } from "@/lib/live-timing/parsers"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
import { useEffect, useState } from "react"
import { COMPOUND_COLORS, COMPOUND_SHORT } from "@/lib/live-timing/constants"
import type { DriverStints } from "@/lib/live-timing/types"

interface Props {
  limit?: number
  racingNumber?: string | null
}

export function TireStrategyChart({ limit = 20, racingNumber }: Props) {
  const { drivers, driverInfoMap } = useLiveTiming()
  const [allStints, setAllStints] = useState<DriverStints[]>([])

  useEffect(() => {
    function loadStints(rawState: Parameters<typeof parseDriverStints>[0]) {
      const stints = parseDriverStints(rawState)
      setAllStints(stints)
    }

    return subscribeLiveTiming(loadStints, 5000)
  }, [])

  if (allStints.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tire Strategy
        </h3>
        <p className="text-xs text-muted-foreground/80">No data available</p>
      </div>
    )
  }

  if (racingNumber && !allStints.some((stint) => stint.racingNumber === racingNumber)) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tire Strategy
        </h3>
        <p className="text-xs text-muted-foreground/80">Sem dados do piloto selecionado</p>
      </div>
    )
  }

  // Ordena stints pela posição do piloto
  const sortedStints = allStints
    .map(stint => ({
      ...stint,
      position: drivers.find(d => d.racingNumber === stint.racingNumber)?.pos || 999
    }))
    .sort((a, b) => a.position - b.position)
    .filter((stint) => (racingNumber ? stint.racingNumber === racingNumber : true))
    .slice(0, limit)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Tire Strategy
      </h3>

      {racingNumber && (
        <p className="text-xs text-muted-foreground/80 mb-3">
          {driverInfoMap[racingNumber]?.fullName || `#${racingNumber}`}
        </p>
      )}

      <div className="space-y-1">
        {sortedStints.map((driverStint) => {
          const info = driverInfoMap[driverStint.racingNumber]
          const lastName = info?.fullName?.split(" ").pop() || `#${driverStint.racingNumber}`
          const teamColor = info?.teamColour ? `#${info.teamColour}` : "var(--muted-foreground)"

          return (
            <div key={driverStint.racingNumber} className="flex items-center gap-2">
              {/* Posição + nome */}
              <div className="flex items-center gap-1.5 w-28 shrink-0">
                <span className="text-[10px] text-muted-foreground/80 w-4 text-right">{driverStint.position !== 999 ? driverStint.position : ""}</span>
                <span
                  className="text-[11px] font-semibold uppercase truncate"
                  style={{ color: teamColor }}
                >
                  {lastName}
                </span>
              </div>

              {/* Stints: mais antigo → mais recente */}
              <div className="flex items-center gap-1 flex-1 overflow-x-auto hide-scrollbar">
                {driverStint.stints.map((stint, stintIndex) => {
                  const compound = stint.compound || "UNKNOWN"
                  const color = COMPOUND_COLORS[compound] || "var(--muted-foreground)"
                  const laps = stint.totalLaps

                  return (
                    <div
                      key={stintIndex}
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                      title={`${compound} — ${laps} voltas (${stint.isNew ? "Novo" : "Usado"})`}
                    >
                      <span className={`text-[10px] font-bold ${
                        compound === "MEDIUM" || compound === "HARD" ? "text-background" : "text-foreground"
                      }`}>
                        {laps}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[10px] flex-wrap">
        {Object.entries(COMPOUND_SHORT).map(([compound, short]) => {
          const color = COMPOUND_COLORS[compound] || "var(--muted-foreground)"
          return (
            <div key={compound} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground/80">{short}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

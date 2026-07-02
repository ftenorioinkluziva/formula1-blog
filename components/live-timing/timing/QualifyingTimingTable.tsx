"use client"

import { Fragment, useState } from "react"
import { useLiveTiming, useSelectDriver } from "../LiveTimingProvider"
import { COMPOUND_COLORS, COMPOUND_SHORT } from "@/lib/live-timing/constants"
import { formatGapMs, formatLapTime, parseLapTimeToMs } from "@/lib/live-timing/formatters"
import { ExpandedSectorRows } from "./ExpandedMiniSectors"
import { useMiniSectors } from "./use-mini-sectors"

const TOTAL_COLUMNS = 12

export function QualifyingTimingTable() {
  const { drivers, driverTimingStats } = useLiveTiming()
  const selectDriver = useSelectDriver()
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set())
  const miniSectorsMap = useMiniSectors()

  function toggleDriver(racingNumber: string) {
    selectDriver(racingNumber)
    setExpandedDrivers(prev => {
      const next = new Set(prev)
      if (next.has(racingNumber)) {
        next.delete(racingNumber)
      } else {
        next.add(racingNumber)
      }
      return next
    })
  }

  const driversWithStats = drivers.map(d => {
    const driverStats = Array.isArray(driverTimingStats)
      ? driverTimingStats.find(stat => stat.racingNumber === d.racingNumber)
      : undefined
    return { ...d, stats: driverStats }
  })

  const fastestLapMs = Math.min(
    ...driversWithStats
      .map((d) => parseLapTimeToMs(d.bestLap))
      .filter((value): value is number => typeof value === "number")
  )

  const fastestSector1Ms = Math.min(
    ...driversWithStats
      .map((d) => parseLapTimeToMs(d.stats?.sector1))
      .filter((value): value is number => typeof value === "number")
  )

  const fastestSector2Ms = Math.min(
    ...driversWithStats
      .map((d) => parseLapTimeToMs(d.stats?.sector2))
      .filter((value): value is number => typeof value === "number")
  )

  const fastestSector3Ms = Math.min(
    ...driversWithStats
      .map((d) => parseLapTimeToMs(d.stats?.sector3))
      .filter((value): value is number => typeof value === "number")
  )

  const fastestTheoreticalBestMs = Math.min(
    ...driversWithStats
      .map((d) => {
        const s1 = parseLapTimeToMs(d.stats?.sector1)
        const s2 = parseLapTimeToMs(d.stats?.sector2)
        const s3 = parseLapTimeToMs(d.stats?.sector3)
        if (typeof s1 !== "number" || typeof s2 !== "number" || typeof s3 !== "number") return null
        return s1 + s2 + s3
      })
      .filter((value): value is number => typeof value === "number")
  )

  function getBestLapGap(bestLap: string) {
    const lapMs = parseLapTimeToMs(bestLap)
    if (!Number.isFinite(fastestLapMs) || !lapMs) return "—"
    const diffMs = Math.max(0, lapMs - fastestLapMs)
    return `+${formatGapMs(diffMs)}`
  }

  function getTheoreticalBestLap(sector1?: string, sector2?: string, sector3?: string): string {
    if (!sector1 || !sector2 || !sector3) return "—"
    const s1 = parseLapTimeToMs(sector1)
    const s2 = parseLapTimeToMs(sector2)
    const s3 = parseLapTimeToMs(sector3)
    if (!s1 || !s2 || !s3) return "—"
    return formatLapTime(s1 + s2 + s3)
  }

  function getTheoreticalBestLapMs(sector1?: string, sector2?: string, sector3?: string): number | null {
    const s1 = parseLapTimeToMs(sector1)
    const s2 = parseLapTimeToMs(sector2)
    const s3 = parseLapTimeToMs(sector3)
    if (typeof s1 !== "number" || typeof s2 !== "number" || typeof s3 !== "number") return null
    return s1 + s2 + s3
  }

  function isBestSector(sectorValue: string | undefined, fastestSectorMs: number): boolean {
    const sectorMs = parseLapTimeToMs(sectorValue)
    return Number.isFinite(fastestSectorMs) && typeof sectorMs === "number" && sectorMs === fastestSectorMs
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/50 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 text-muted-foreground font-semibold w-12">Pos</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold">Piloto</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold">Equipe</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right">Melhor Volta</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right">Theoretical Best</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right">Gap</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-center">Pit</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right text-xs">S1</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right text-xs">S2</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right text-xs">S3</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-right text-xs">Vel Top</th>
              <th className="px-3 py-2 text-muted-foreground font-semibold text-center">Pneu</th>
            </tr>
          </thead>
          <tbody>
            {driversWithStats.map((d) => {
              const isExpanded = expandedDrivers.has(d.racingNumber)
              const compoundColor = COMPOUND_COLORS[d.compound] || "var(--muted-foreground)"
              const compoundLabel = COMPOUND_SHORT[d.compound] || "?"
              const lapMs = parseLapTimeToMs(d.bestLap)
              const isFastestLap = Number.isFinite(fastestLapMs) && lapMs === fastestLapMs
              const theoreticalBestLapMs = getTheoreticalBestLapMs(d.stats?.sector1, d.stats?.sector2, d.stats?.sector3)
              const isFastestTheoreticalBest = Number.isFinite(fastestTheoreticalBestMs) && theoreticalBestLapMs === fastestTheoreticalBestMs
              const miniSectors = miniSectorsMap.get(d.racingNumber)

              return (
                <Fragment key={d.racingNumber}>
                  <tr
                    className={`border-b border-border/50 hover:bg-foreground/10 cursor-pointer transition-colors ${
                      isExpanded ? "bg-blue-500/20 ring-2 ring-blue-500/50" : ""
                    } ${d.inPit ? "opacity-60" : ""}`}
                    onClick={() => toggleDriver(d.racingNumber)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleDriver(d.racingNumber)
                      }
                    }}
                  >
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`flex w-8 h-8 rounded items-center justify-center font-bold ${
                          d.pos === 1
                            ? "bg-yellow-500/20 text-yellow-400"
                            : d.pos === 2
                              ? "bg-muted-foreground/20 text-foreground/80"
                              : d.pos === 3
                                ? "bg-orange-600/20 text-orange-400"
                                : "text-muted-foreground"
                        }`}
                      >
                        {d.pos}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1 h-8 rounded-full"
                          style={{ backgroundColor: `#${d.teamColour}` }}
                        />
                        <span className="font-bold text-foreground">{d.tla}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{d.teamName}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs ${
                        isFastestLap ? "text-emerald-300" : "text-foreground"
                      }`}
                    >
                      {d.bestLap}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs ${
                        isFastestTheoreticalBest ? "text-emerald-300" : "text-foreground/80"
                      }`}
                    >
                      {getTheoreticalBestLap(d.stats?.sector1, d.stats?.sector2, d.stats?.sector3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {getBestLapGap(d.bestLap)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold ${
                          d.inPit
                            ? "bg-orange-500/20 text-orange-300"
                            : d.pitOut
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {d.inPit ? "PIT" : d.pitOut ? "OUT LAP" : "OUT"}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs ${
                        isBestSector(d.stats?.sector1, fastestSector1Ms) ? "text-emerald-300" : "text-muted-foreground"
                      }`}
                    >
                      {d.stats?.sector1 || "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs ${
                        isBestSector(d.stats?.sector2, fastestSector2Ms) ? "text-emerald-300" : "text-muted-foreground"
                      }`}
                    >
                      {d.stats?.sector2 || "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs ${
                        isBestSector(d.stats?.sector3, fastestSector3Ms) ? "text-emerald-300" : "text-muted-foreground"
                      }`}
                    >
                      {d.stats?.sector3 || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {d.stats?.topSpeed ? `${d.stats.topSpeed} km/h` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                            d.compound === "MEDIUM" || d.compound === "HARD" ? "text-background" : "text-foreground"
                          }`}
                          style={{ backgroundColor: compoundColor }}
                        >
                          {compoundLabel}
                        </span>
                        {d.isNew && (
                          <span className="text-green-400 text-xs font-bold">NEW</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && miniSectors && (
                    <ExpandedSectorRows miniSectors={miniSectors} totalColumns={TOTAL_COLUMNS} />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {drivers.length === 0 && (
        <div className="p-8 text-center text-muted-foreground/80">Nenhum dado de timing disponível</div>
      )}
    </div>
  )
}

"use client"

import { Fragment, useEffect, useState } from "react"
import { fetchLiveTiming } from "@/lib/live-timing/api"
import { parseDriverMiniSectors } from "@/lib/live-timing/parsers"
import type { DriverMiniSectors } from "@/lib/live-timing/types"

const POLLING_MS = 2000

const SEGMENT_COLORS: Record<number, string> = {
  2048: "var(--status-warning)",  // amarelo
  2049: "var(--status-success)",  // verde — personal best
  2051: "var(--status-purple)",  // roxo
  2064: "var(--status-danger)",  // vermelho — red flag
}

function segmentColor(status: number): string {
  return SEGMENT_COLORS[status] ?? "var(--secondary)"
}

function sectorBorderColor(s: { overallFastest: boolean; personalFastest: boolean }): string {
  if (s.overallFastest) return "var(--status-purple)"
  if (s.personalFastest) return "var(--status-success)"
  return "var(--border)"
}

const SECTOR_LABELS = ["S1", "S2", "S3"]

export function MiniSectorGrid() {
  const [drivers, setDrivers] = useState<DriverMiniSectors[]>([])

  useEffect(() => {
    async function load() {
      const raw = await fetchLiveTiming()
      if (!raw) return
      const parsed = parseDriverMiniSectors(raw)
      parsed.sort((a, b) => a.position - b.position)
      setDrivers(parsed)
    }
    load()
    const id = setInterval(load, POLLING_MS)
    return () => clearInterval(id)
  }, [])

  if (drivers.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Mini-Setores
        </h3>
        <p className="text-sm text-muted-foreground/80">Sem dados de Segments disponíveis</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Mini-Setores
        </h3>
        <div className="flex items-center gap-3">
          {[
            { color: "var(--status-purple)", label: "Melhor geral" },
            { color: "var(--status-success)", label: "Melhor pessoal" },
            { color: "var(--status-warning)", label: "Em progresso" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1" title={item.label}>
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground/60">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 mb-4">Fonte: TimingData.Sectors[].Segments</p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="hidden sm:table-cell text-center text-muted-foreground/80 font-medium pb-2 w-10">POS</th>
              <th className="text-left text-muted-foreground/80 font-medium pb-2 w-14">PIL</th>
              <th className="hidden sm:table-cell text-left text-muted-foreground/80 font-medium pb-2 w-16">TIPO</th>
              {SECTOR_LABELS.map((s) => (
                <th key={s} className="text-center text-muted-foreground/80 font-medium pb-2 px-2">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => {
              const renderSectorCell = (
                sector: DriverMiniSectors["sectors"][number],
                key: string,
                rowType: "current" | "best",
                sectorIndex: number,
              ) => (
                <td key={key} className="py-1.5 px-2 align-middle">
                  <div
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded border"
                    style={{ borderColor: sectorBorderColor(sector) }}
                    title={sector.value || "Sem valor de setor"}
                  >
                    {sectorIndex === 0 && (
                      <span className="sm:hidden mr-1 rounded px-1 py-0.5 text-[9px] uppercase tracking-wider font-semibold text-foreground/80 bg-secondary border border-border">
                        {rowType === "current" ? "Atual" : "Melhor"}
                      </span>
                    )}
                    {sector.segments.length > 0 ? (
                      sector.segments.map((seg, segIdx) => (
                        <div
                          key={segIdx}
                          className="rounded-sm"
                          style={{
                            width: 5,
                            height: 10,
                            backgroundColor: segmentColor(seg.status),
                            flexShrink: 0,
                          }}
                        />
                      ))
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                    {sector.value && (
                      <span
                        className="ml-1.5 text-sm font-mono font-semibold leading-none tabular-nums"
                        style={{
                          color: sector.overallFastest
                            ? "var(--status-purple)"
                            : sector.personalFastest
                              ? "var(--status-success)"
                              : "var(--muted-foreground)",
                        }}
                      >
                        {sector.value}
                      </span>
                    )}
                  </div>
                </td>
              )

              return (
                <Fragment key={driver.racingNumber}>
                  <tr key={`${driver.racingNumber}-current`} className="border-b border-border hover:bg-secondary">
                    <td className="hidden sm:table-cell py-1.5 text-center text-muted-foreground/80 font-medium" rowSpan={2}>{driver.position}</td>
                    <td className="py-1.5" rowSpan={2}>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-0.5 h-8 rounded"
                          style={{ backgroundColor: `#${driver.teamColour}` }}
                        />
                        <span className="font-bold text-foreground">{driver.tla}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell py-1.5 text-[10px] uppercase text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>Atual</span>
                        {driver.pitOut ? (
                          <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">OUT LAP</span>
                        ) : driver.inPit ? (
                          <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30">PIT</span>
                        ) : null}
                      </div>
                    </td>
                    {driver.sectors.map((sector, si) => renderSectorCell(sector, `${driver.racingNumber}-cur-${si}`, "current", si))}
                    {driver.sectors.length < 3 &&
                      Array.from({ length: 3 - driver.sectors.length }).map((_, i) => (
                        <td key={`${driver.racingNumber}-cur-empty-${i}`} className="py-1.5 px-2 text-muted-foreground/50">—</td>
                      ))}
                  </tr>

                  <tr key={`${driver.racingNumber}-best`} className="border-b border-border/70 bg-card hover:bg-secondary">
                    <td className="hidden sm:table-cell py-1.5 text-[10px] uppercase text-foreground/80 font-medium">Melhor</td>
                    {driver.bestSectors.map((sector, si) => renderSectorCell(sector, `${driver.racingNumber}-best-${si}`, "best", si))}
                    {driver.bestSectors.length < 3 &&
                      Array.from({ length: 3 - driver.bestSectors.length }).map((_, i) => (
                        <td key={`${driver.racingNumber}-best-empty-${i}`} className="py-1.5 px-2 text-muted-foreground/50">—</td>
                      ))}
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

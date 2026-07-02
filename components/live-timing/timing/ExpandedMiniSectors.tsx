"use client"

import type { DriverMiniSectors, DriverSectorMini } from "@/lib/live-timing/types"

const SEGMENT_COLORS: Record<number, string> = {
  2048: "var(--status-warning)",
  2049: "var(--status-success)",
  2051: "var(--status-purple)",
  2064: "var(--status-danger)",
}

function segmentColor(status: number): string {
  return SEGMENT_COLORS[status] ?? "var(--secondary)"
}

function sectorBorderColor(s: { overallFastest: boolean; personalFastest: boolean }): string {
  if (s.overallFastest) return "var(--status-purple)"
  if (s.personalFastest) return "var(--status-success)"
  return "var(--border)"
}

function SectorCell({ sector }: { sector: DriverSectorMini }) {
  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-1 rounded border"
      style={{ borderColor: sectorBorderColor(sector) }}
    >
      {sector.segments.length > 0 ? (
        sector.segments.map((seg, i) => (
          <div
            key={i}
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
  )
}

function SectorRowCells({ sectors, label, labelClass, totalColumns }: {
  sectors: DriverSectorMini[]
  label: string
  labelClass: string
  totalColumns: number
}) {
  const filled = [...sectors]
  while (filled.length < 3) {
    filled.push({ stopped: false, value: "", overallFastest: false, personalFastest: false, segments: [] })
  }

  const sectorColSpan = Math.max(1, Math.floor((totalColumns - 1) / 3))
  const remainingCols = totalColumns - 1 - sectorColSpan * 3

  return (
    <>
      <td className="px-3 py-1.5">
        <span className={`text-[10px] uppercase font-semibold ${labelClass}`}>{label}</span>
      </td>
      {filled.map((sector, i) => (
        <td key={i} colSpan={sectorColSpan} className="py-1 px-1">
          {sector.segments.length > 0 || sector.value ? (
            <SectorCell sector={sector} />
          ) : (
            <span className="text-muted-foreground/50 text-xs">—</span>
          )}
        </td>
      ))}
      {remainingCols > 0 && <td colSpan={remainingCols} />}
    </>
  )
}

export function ExpandedSectorRows({ miniSectors, totalColumns }: {
  miniSectors: DriverMiniSectors
  totalColumns: number
}) {
  return (
    <>
      <tr className="bg-card">
        <SectorRowCells sectors={miniSectors.sectors} label="Atual" labelClass="text-muted-foreground" totalColumns={totalColumns} />
      </tr>
      <tr className="bg-background border-b border-border">
        <SectorRowCells sectors={miniSectors.bestSectors} label="Melhor" labelClass="text-foreground/80 font-bold" totalColumns={totalColumns} />
      </tr>
    </>
  )
}

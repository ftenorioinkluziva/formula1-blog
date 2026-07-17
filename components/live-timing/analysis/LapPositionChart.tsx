"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
import { parseLapSeries } from "@/lib/live-timing/parsers"
import type { DriverLapSeries } from "@/lib/live-timing/types"

const POLLING_MS = 5000

export function LapPositionChart() {
  const [series, setSeries] = useState<DriverLapSeries[]>([])
  const [fullNameByTla, setFullNameByTla] = useState<Record<string, string>>({})

  useEffect(() => {
    function load(raw: Parameters<typeof parseLapSeries>[0]) {
      const parsedSeries = parseLapSeries(raw)
      parsedSeries.sort((a, b) => {
        const aCurrentPosition = a.laps[a.laps.length - 1]?.position || 99
        const bCurrentPosition = b.laps[b.laps.length - 1]?.position || 99
        return aCurrentPosition - bCurrentPosition
      })
      setSeries(parsedSeries)
      const driverList = raw.DriverList || {}
      const map: Record<string, string> = {}
      for (const driver of Object.values(driverList)) {
        const driverRecord = driver as Record<string, unknown>
        const tla = String(driverRecord.Tla || "")
        const fullName = String(driverRecord.FullName || tla)
        if (tla) {
          map[tla] = fullName
        }
      }
      setFullNameByTla(map)
    }
    return subscribeLiveTiming(load, POLLING_MS)
  }, [])

  if (series.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Evolução de Posição por Volta
        </h3>
        <p className="text-sm text-muted-foreground/80">Sem dados de LapSeries disponíveis</p>
      </div>
    )
  }

  const maxLap = Math.max(...series.flatMap((d) => d.laps.map((l) => l.lap)))
  const chartData = Array.from({ length: maxLap }, (_, i) => {
    const lap = i + 1
    const point: Record<string, number | null> = { lap }
    for (const driver of series) {
      const found = driver.laps.find((l) => l.lap === lap)
      point[driver.tla] = found ? found.position : null
    }
    return point
  })

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Evolução de Posição por Volta
      </h3>
      <p className="text-xs text-muted-foreground/60 mb-4">Fonte: LapSeries</p>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="lap"
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            label={{ value: "Volta", position: "insideBottomRight", offset: -4, fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            reversed
            domain={[1, 20]}
            ticks={[1, 5, 10, 15, 20]}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            label={{ value: "Posição", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => {
              const fullName = fullNameByTla[name] || name
              return [`P${value}`, `${name} · ${fullName}`]
            }}
            labelFormatter={(label) => `Volta ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)", paddingTop: 8 }} />
          {series.map((driver) => (
            <Line
              key={driver.racingNumber}
              type="monotone"
              dataKey={driver.tla}
              stroke={`#${driver.teamColour}`}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

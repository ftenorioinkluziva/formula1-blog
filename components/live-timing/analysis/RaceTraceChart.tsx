"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
import { parseRaceTraceSnapshot } from "@/lib/live-timing/parsers"
import type { RaceTracePoint } from "@/lib/live-timing/types"

interface Props {
  limit?: number
}

type RaceTraceFilter = "top5" | "top10" | "top15" | "all" | "plus20"

const POLLING_MS = 2000
const MAX_SAMPLES_WINDOW = 120
const MAX_SAMPLES_HARD_CAP = 3000
const MAX_RENDER_POINTS = 900
const FILTER_OPTIONS: Array<{ value: RaceTraceFilter; label: string }> = [
  { value: "top5", label: "Top 5" },
  { value: "top10", label: "Top 10" },
  { value: "top15", label: "Top 15" },
  { value: "all", label: "Todos" },
  { value: "plus20", label: "Até +20s" },
]

type DriverRaceTraceHistory = {
  racingNumber: string
  tla: string
  fullName: string
  teamColour: string
  points: Array<RaceTracePoint & { sample: number; capturedAtMs: number }>
}

function mergePoints(
  existing: Array<RaceTracePoint & { sample: number; capturedAtMs: number }>,
  incoming: Array<RaceTracePoint & { sample: number; capturedAtMs: number }>,
): Array<RaceTracePoint & { sample: number; capturedAtMs: number }> {
  return [...existing, ...incoming]
    .sort((a, b) => a.sample - b.sample)
    .slice(-MAX_SAMPLES_HARD_CAP)
}

export function RaceTraceChart({ limit }: Props) {
  const [historyByDriver, setHistoryByDriver] = useState<Record<string, DriverRaceTraceHistory>>({})
  const [activeFilter, setActiveFilter] = useState<RaceTraceFilter>("all")
  const [showFromFirstLap, setShowFromFirstLap] = useState(false)
  const sampleCounterRef = useRef(0)

  useEffect(() => {
    function load(rawState: Parameters<typeof parseRaceTraceSnapshot>[0]) {
      const snapshot = parseRaceTraceSnapshot(rawState)
      if (snapshot.length === 0) return

      const sample = sampleCounterRef.current + 1
      sampleCounterRef.current = sample
      const capturedAtMs = Date.now()

      setHistoryByDriver((previous) => {
        const next = { ...previous }

        for (const trace of snapshot) {
          const existing = next[trace.racingNumber]
          next[trace.racingNumber] = {
            racingNumber: trace.racingNumber,
            tla: trace.tla,
            fullName: String((rawState.DriverList?.[trace.racingNumber] as Record<string, unknown> | undefined)?.FullName || trace.tla),
            teamColour: trace.teamColour,
            points: mergePoints(
              existing?.points || [],
              trace.points.map((point) => ({
                ...point,
                sample,
                capturedAtMs,
              })),
            ),
          }
        }

        return next
      })
    }

    return subscribeLiveTiming(load, POLLING_MS)
  }, [])

  const selectedDrivers = useMemo(() => {
    const drivers = Object.values(historyByDriver)
    const latestPoint = (driver: DriverRaceTraceHistory) => driver.points[driver.points.length - 1]

    const sortedDrivers = drivers
      .filter((driver) => driver.points.length > 0)
      .sort((a, b) => {
        const aGap = latestPoint(a)?.gapToLeaderSeconds ?? Number.POSITIVE_INFINITY
        const bGap = latestPoint(b)?.gapToLeaderSeconds ?? Number.POSITIVE_INFINITY
        return aGap - bGap
      })

    const byFilter = (() => {
      if (activeFilter === "top5") return sortedDrivers.slice(0, 5)
      if (activeFilter === "top10") return sortedDrivers.slice(0, 10)
      if (activeFilter === "top15") return sortedDrivers.slice(0, 15)
      if (activeFilter === "plus20") {
        return sortedDrivers.filter((driver) => {
          const latestGap = latestPoint(driver)?.gapToLeaderSeconds
          return typeof latestGap === "number" && latestGap <= 20
        })
      }
      return sortedDrivers
    })()

    if (!limit || limit <= 0) {
      return byFilter
    }

    return byFilter.slice(0, limit)
  }, [activeFilter, historyByDriver, limit])

  const chartData = useMemo(() => {
    if (selectedDrivers.length === 0) return []

    const samples = new Set<number>()
    for (const driver of selectedDrivers) {
      for (const point of driver.points) {
        samples.add(point.sample)
      }
    }

    return Array.from(samples)
      .sort((a, b) => a - b)
      .map((sample) => {
        const row: Record<string, number | null | string> = { sample }
        let lapReference = 0
        let timeReference = ""

        for (const driver of selectedDrivers) {
          const point = driver.points.find((item) => item.sample === sample)
          row[driver.tla] = point?.gapToLeaderSeconds ?? null
          if (point && lapReference === 0) {
            lapReference = point.lap
            timeReference = new Date(point.capturedAtMs).toLocaleTimeString("pt-BR")
          }
        }

        row.__lap = lapReference
        row.__time = timeReference
        return row
      })
  }, [selectedDrivers])

  const fullNameByTla = useMemo(() => {
    return new Map(selectedDrivers.map((driver) => [driver.tla, driver.fullName]))
  }, [selectedDrivers])

  const visibleChartData = useMemo(() => {
    if (!showFromFirstLap) {
      return chartData.slice(-MAX_SAMPLES_WINDOW)
    }

    if (chartData.length <= MAX_RENDER_POINTS) {
      return chartData
    }

    const stride = Math.ceil(chartData.length / MAX_RENDER_POINTS)
    const sampled = chartData.filter((_, index) => index % stride === 0)
    const lastPoint = chartData[chartData.length - 1]
    const hasLastPoint = sampled[sampled.length - 1]?.sample === lastPoint?.sample
    return hasLastPoint ? sampled : [...sampled, lastPoint]
  }, [chartData, showFromFirstLap])

  const lapTicksBySample = useMemo(() => {
    const ticks: number[] = []
    const lapBySample = new Map<number, number>()
    let previousLap = -1

    for (const row of visibleChartData) {
      const sample = Number(row.sample)
      const lap = Number(row.__lap || 0)
      if (!sample || !lap) continue

      lapBySample.set(sample, lap)
      if (lap !== previousLap) {
        ticks.push(sample)
        previousLap = lap
      }
    }

    return { ticks, lapBySample }
  }, [visibleChartData])

  if (visibleChartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Race Trace
        </h3>
        <p className="text-xs text-muted-foreground/80">Sem dados de gap vs líder disponíveis</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Race Trace
      </h3>
      <p className="text-xs text-muted-foreground/60 mb-3">Gap para o líder por volta</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveFilter(option.value)}
              className={[
                "px-2 py-1 text-xs rounded border transition-colors",
                isActive
                  ? "bg-secondary border-muted-foreground text-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground/90",
              ].join(" ")}
            >
              {option.label}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setShowFromFirstLap((prev) => !prev)}
          className={[
            "px-2 py-1 text-xs rounded border transition-colors ml-auto",
            showFromFirstLap
              ? "bg-secondary border-muted-foreground text-foreground"
              : "bg-background border-border text-muted-foreground hover:text-foreground/90",
          ].join(" ")}
        >
          {showFromFirstLap ? "Janela Atual" : "Desde 1ª volta"}
        </button>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={visibleChartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="sample"
            ticks={lapTicksBySample.ticks}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(sample) => {
              const lap = lapTicksBySample.lapBySample.get(Number(sample))
              return lap ? `${lap}` : ""
            }}
            label={{ value: "Volta", position: "insideBottomRight", offset: -4, fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            label={{ value: "Gap (s)", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => {
              const fullName = fullNameByTla.get(name) || name
              return [`+${value.toFixed(3)}s`, `${name} · ${fullName}`]
            }}
            labelFormatter={(label, payload) => {
              const firstPayload = payload?.[0]?.payload as { __lap?: number; __time?: string } | undefined
              const lapLabel = firstPayload?.__lap ? `Volta ${firstPayload.__lap}` : "Volta —"
              const timeLabel = firstPayload?.__time ? ` · ${firstPayload.__time}` : ""
              return `Amostra ${label} (${lapLabel}${timeLabel})`
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)", paddingTop: 8 }} />
          {selectedDrivers.map((driver) => (
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

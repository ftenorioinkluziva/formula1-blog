"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatMsToLapTime } from "@/lib/analytics/lap-time-parser"
import type { QualifyingResponse, QualifyingEntry } from "@/lib/analytics/types"

interface Props {
  season: number
  round: number
  locale: string
}

type QSession = "Q1" | "Q2" | "Q3"

const SESSION_OPTIONS: Array<{ value: QSession; label: string }> = [
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Q3", label: "Q3" },
]

function getSessionTime(entry: QualifyingEntry, session: QSession): number | null {
  if (session === "Q1") return entry.q1TimeMs
  if (session === "Q2") return entry.q2TimeMs
  return entry.q3TimeMs
}

export function QualifyingBreakdownChart({ season, round, locale }: Props) {
  const [data, setData] = useState<QualifyingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<QSession>("Q3")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/qualifying?season=${season}&round=${round}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, round, locale])

  const { chartData, bestTimeMs } = useMemo(() => {
    if (!data) return { chartData: [], bestTimeMs: null }

    const driversWithTime = data.results
      .map((r) => {
        const timeMs = getSessionTime(r, session)
        return { ...r, timeMs }
      })
      .filter((r) => r.timeMs !== null)
      .sort((a, b) => a.timeMs! - b.timeMs!)

    const best = driversWithTime[0]?.timeMs ?? null

    const items = driversWithTime.map((r) => ({
      driver: r.driverCode,
      gap: best !== null && r.timeMs !== null ? (r.timeMs - best) / 1000 : null,
      time: r.timeMs !== null ? r.timeMs / 1000 : null,
      color: r.teamColor,
      position: r.position,
      q1: r.q1TimeMs,
      q2: r.q2TimeMs,
      q3: r.q3TimeMs,
      sessionTime: r.timeMs,
      participated: session === "Q3" ? r.q3TimeMs !== null : session === "Q2" ? r.q2TimeMs !== null : true,
    }))

    return { chartData: items, bestTimeMs: best }
  }, [data, session])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading qualifying data...</div>
  }

  if (!data || !data.results.length) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No qualifying data available</div>
  }

  const driversInSession = session === "Q1" ? 20 : session === "Q2" ? 15 : 10

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SESSION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSession(opt.value)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              session === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/80">
        Showing {chartData.length} drivers who participated in {session} (top {driversInSession})
        {bestTimeMs !== null && ` — Fastest: ${formatMsToLapTime(bestTimeMs)}`}
      </p>

      <ResponsiveContainer width="100%" height={Math.max(360, chartData.length * 28)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => `+${v.toFixed(3)}`}
            domain={[0, "auto"]}
          />
          <YAxis type="category" dataKey="driver" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={36} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: 12 }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value, _name, props) => {
              const d = props.payload as (typeof chartData)[number] | undefined
              if (!d) return [String(value), ""]
              const lines: string[] = []
              if (d.q1 !== null) lines.push(`Q1: ${formatMsToLapTime(d.q1!)}`)
              if (d.q2 !== null) lines.push(`Q2: ${formatMsToLapTime(d.q2!)}`)
              if (d.q3 !== null) lines.push(`Q3: ${formatMsToLapTime(d.q3!)}`)
              const gapStr = d.gap !== null ? `+${d.gap.toFixed(3)}s` : ""
              return [`${gapStr} ${lines.join(" | ")}`, `P${d.position}`]
            }}
          />
          <Bar dataKey="gap" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={entry.participated ? 0.85 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

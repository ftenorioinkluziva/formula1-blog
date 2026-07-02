"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ChampionshipResponse } from "@/lib/analytics/types"

interface Props {
  season: number
  locale: string
}

export function ChampionshipProgressionChart({ season, locale }: Props) {
  const [data, setData] = useState<ChampionshipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<"drivers" | "constructors">("drivers")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/championship?season=${season}&type=${type}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, type, locale])

  const chartData = useMemo(() => {
    if (!data || !data.rounds.length) return []

    return data.rounds.map((round, i) => {
      const point: Record<string, number | string> = {
        round: round.round,
        name: round.grandPrixName.replace(" Grand Prix", ""),
      }
      for (const prog of data.progressions) {
        point[prog.code] = prog.pointsByRound[i]?.cumulative ?? 0
      }
      return point
    })
  }, [data])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading championship data...</div>
  }

  if (!data || !data.progressions.length) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No championship data available</div>
  }

  const top10 = data.progressions.slice(0, 10)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setType("drivers")}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            type === "drivers" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
          }`}
        >
          Drivers
        </button>
        <button
          onClick={() => setType("constructors")}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            type === "constructors" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
          }`}
        >
          Constructors
        </button>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 44 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          {top10.map((prog) => (
            <Line
              key={prog.code}
              type="monotone"
              dataKey={prog.code}
              stroke={prog.color}
              strokeWidth={2}
              dot={{ r: 3, fill: prog.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 text-xs">
        {top10.map((prog) => (
          <span key={prog.code} className="flex items-center gap-1">
            <span className="w-3 h-1 rounded" style={{ backgroundColor: prog.color }} />
            <span className="text-muted-foreground">{prog.code}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

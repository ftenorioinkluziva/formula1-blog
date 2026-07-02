"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ReliabilityResponse } from "@/lib/analytics/types"

interface Props {
  season: number
  locale: string
}

export function ReliabilityTracker({ season, locale }: Props) {
  const [data, setData] = useState<ReliabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/reliability?season=${season}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, locale])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading reliability data...</div>
  }

  if (!data || !data.drivers.length) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No retirements recorded this season</div>
  }

  const chartData = data.drivers.map((d) => ({
    driver: `${d.driverCode}`,
    dnfs: d.dnfCount,
    color: d.teamColor,
    fullName: d.fullName,
    types: Object.entries(d.dnfsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(", "),
  }))

  const totalDnfs = chartData.reduce((sum, d) => sum + d.dnfs, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="bg-secondary px-2 py-1 rounded">
          Total retirements: {totalDnfs}
        </span>
        <span className="bg-secondary px-2 py-1 rounded">
          Drivers affected: {chartData.length}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            allowDecimals={false}
            label={{ value: "Retirements (DNFs)", position: "insideBottom", offset: -2, fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <YAxis type="category" dataKey="driver" stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={42} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: 12 }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value, _name, props) => {
              const d = props.payload as (typeof chartData)[number] | undefined
              if (!d) return [String(value), ""]
              return [
                `${value} retirement${Number(value) !== 1 ? "s" : ""} — ${d.types}`,
                d.fullName,
              ]
            }}
          />
          <Bar dataKey="dnfs" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/60">
        Shows drivers who did not finish (DNF) in race sessions. Includes mechanical failures, accidents, collisions, and other non-finishes.
        A driver who finishes the race but is classified as &quot;lapped&quot; is NOT counted as a DNF.
      </p>
    </div>
  )
}

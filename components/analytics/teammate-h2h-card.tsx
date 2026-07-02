"use client"

import { useEffect, useState } from "react"
import { formatMsToLapTime } from "@/lib/analytics/lap-time-parser"
import type { TeammateH2HResponse } from "@/lib/analytics/types"

interface Props {
  season: number
  locale: string
}

export function TeammateH2HCard({ season, locale }: Props) {
  const [data, setData] = useState<TeammateH2HResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/teammate-h2h?season=${season}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, locale])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading head-to-head data...</div>
  }

  if (!data || !data.teams.length) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No head-to-head data available</div>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.teams.map((team) => {
        const qualiTotal = team.qualiBattle[0] + team.qualiBattle[1]
        const raceTotal = team.raceBattle[0] + team.raceBattle[1]

        return (
          <div
            key={team.teamName}
            className="bg-card border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.teamColor }} />
              <span className="text-sm font-medium text-foreground">{team.teamName}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground/80 font-medium">{team.driver1.code}</span>
              <span className="text-muted-foreground/80">vs</span>
              <span className="text-foreground/80 font-medium">{team.driver2.code}</span>
            </div>

            <BattleBar label="Qualifying" left={team.qualiBattle[0]} right={team.qualiBattle[1]} total={qualiTotal} color={team.teamColor} />
            <BattleBar label="Race" left={team.raceBattle[0]} right={team.raceBattle[1]} total={raceTotal} color={team.teamColor} />

            <div className="flex justify-between text-[11px] text-muted-foreground/80 pt-1 border-t border-border">
              <span>
                Avg quali gap:{" "}
                {team.avgQualiGapMs !== null ? (
                  <span className={team.avgQualiGapMs < 0 ? "text-green-400" : "text-red-400"}>
                    {team.avgQualiGapMs < 0 ? "-" : "+"}
                    {formatMsToLapTime(Math.abs(team.avgQualiGapMs))}
                  </span>
                ) : (
                  "N/A"
                )}
              </span>
              <span>
                Points: <span className="text-foreground/80">{team.pointsDelta > 0 ? `+${team.pointsDelta}` : team.pointsDelta}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BattleBar({ label, left, right, total, color }: { label: string; left: number; right: number; total: number; color: string }) {
  const leftPct = total > 0 ? (left / total) * 100 : 50

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{left}</span>
        <span className="text-muted-foreground/80">{label}</span>
        <span className="text-muted-foreground">{right}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
        <div className="h-full rounded-l-full" style={{ width: `${leftPct}%`, backgroundColor: color, opacity: 0.8 }} />
        <div className="h-full rounded-r-full" style={{ width: `${100 - leftPct}%`, backgroundColor: color, opacity: 0.4 }} />
      </div>
    </div>
  )
}

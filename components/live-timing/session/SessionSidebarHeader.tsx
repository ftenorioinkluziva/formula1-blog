"use client"

import { useLiveTiming } from "../LiveTimingProvider"

const SESSION_PART_LABEL: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3" }

export function SessionSidebarHeader() {
  const { session, lapCount } = useLiveTiming()

  const partLabel = session?.part ? SESSION_PART_LABEL[session.part] ?? `Q${session.part}` : null
  const title = session ? `${session.name}${session.type ? `: ${session.type}` : ""}` : "Session"

  const currentLap = lapCount?.currentLap ?? 0
  const totalLaps = lapCount?.totalLaps ?? 0
  const lapsLeft = totalLaps > 0 ? Math.max(0, totalLaps - currentLap) : null

  const subline = totalLaps > 0
    ? `Lap: ${currentLap}/${totalLaps}${lapsLeft !== null ? ` (${lapsLeft} left)` : ""}`
    : session
      ? `${session.circuit} · ${session.country}`
      : "—"

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="text-foreground font-semibold text-sm">
        {title}
        {partLabel && <span className="text-red-400 ml-2 text-xs">{partLabel}</span>}
      </div>
      <div className="text-muted-foreground text-xs mt-1">
        {subline}
      </div>
    </div>
  )
}

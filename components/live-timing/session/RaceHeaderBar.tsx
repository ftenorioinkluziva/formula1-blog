"use client"

import { useLiveTiming } from "../LiveTimingProvider"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AllClear: { label: "All Clear", color: "text-green-300", bg: "bg-green-500/20 border-green-500/30" },
  Yellow: { label: "Yellow", color: "text-yellow-300", bg: "bg-yellow-500/20 border-yellow-500/30" },
  SafetyCar: { label: "Safety Car", color: "text-yellow-200", bg: "bg-yellow-600/20 border-yellow-600/30" },
  SCDeployed: { label: "Safety Car", color: "text-yellow-200", bg: "bg-yellow-600/20 border-yellow-600/30" },
  VSCDeployed: { label: "VSC", color: "text-yellow-200", bg: "bg-yellow-600/20 border-yellow-600/30" },
  VSCEnding: { label: "VSC Ending", color: "text-yellow-200", bg: "bg-yellow-600/20 border-yellow-600/30" },
  SCEnding: { label: "SC Ending", color: "text-yellow-200", bg: "bg-yellow-600/20 border-yellow-600/30" },
  Red: { label: "Red", color: "text-red-300", bg: "bg-red-500/20 border-red-500/30" },
}

const STATUS_CODE_FALLBACK: Record<string, keyof typeof STATUS_CONFIG> = {
  "1": "AllClear",
  "2": "Yellow",
  "3": "SafetyCar",
  "4": "Red",
  "5": "VSCDeployed",
  "6": "VSCEnding",
  "7": "SCEnding",
}

const SESSION_PART_LABEL: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3" }

function toWindDirection(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  const index = Math.round(deg / 45) % 8
  return dirs[index]
}

function toKmH(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "—"
  return (numeric * 3.6).toFixed(1)
}

export function RaceHeaderBar() {
  const { session, sessionState, lapCount, weather, trackStatus } = useLiveTiming()

  const partLabel = session?.part ? SESSION_PART_LABEL[session.part] ?? `Q${session.part}` : null
  const title = session ? `${session.name}${session.type ? `: ${session.type}` : ""}` : "Race"

  const remaining = sessionState?.remaining || "—"
  const currentLap = lapCount?.currentLap ?? 0
  const totalLaps = lapCount?.totalLaps ?? 0
  const lapsLeft = totalLaps > 0 ? Math.max(0, totalLaps - currentLap) : null

  const weatherWindDeg = Number(weather?.windDirection || 0)
  const windSpeed = weather?.windSpeed ? `${toKmH(weather.windSpeed)} km/h` : "—"
  const windDir = toWindDirection(weatherWindDeg)

  const statusKey = trackStatus?.message && STATUS_CONFIG[trackStatus.message]
    ? trackStatus.message
    : trackStatus?.status
      ? STATUS_CODE_FALLBACK[trackStatus.status]
      : undefined

  const status = statusKey ? STATUS_CONFIG[statusKey] : null

  return (
    <div className="bg-background border border-border rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-6 rounded bg-card border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
            GP
          </div>
          <div>
            <div className="text-foreground font-semibold text-sm sm:text-base">
              {title}
              {partLabel && <span className="text-red-400 ml-2 text-xs">{partLabel}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Lap: {currentLap}/{totalLaps}</span>
              {lapsLeft !== null && <span>({lapsLeft} left)</span>}
              {status && statusKey !== "AllClear" && (
                <span className={`px-2 py-0.5 rounded-md border ${status.bg} ${status.color} font-bold uppercase`}> 
                  {status.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-foreground/80">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Wind</span>
            <span className="text-foreground font-semibold">{windSpeed} {windDir}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Track</span>
            <span className="text-foreground font-semibold">{weather?.trackTemp ?? "—"}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Air</span>
            <span className="text-foreground font-semibold">{weather?.airTemp ?? "—"}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Humidity</span>
            <span className="text-foreground font-semibold">{weather?.humidity ?? "—"}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Pressure</span>
            <span className="text-foreground font-semibold">{weather?.pressure ?? "—"} mb</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Rain</span>
            <span className="text-foreground font-semibold">
              {weather && Number(weather.rainfall) > 0 ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

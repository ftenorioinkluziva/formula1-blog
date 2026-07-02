"use client"

import { useMemo } from "react"
import { Loader2 } from "lucide-react"

export interface LapRow {
  driverId: number
  driverCode: string
  driverNumber: number
  fullName: string
  teamColor: string
  lapNumber: number
  lapTime: string | null
  sector1: string | null
  sector2: string | null
  sector3: string | null
  i1Speed: number | null
  i2Speed: number | null
  stSpeed: number | null
  compound: string | null
  pitIn: boolean
  pitOut: boolean
  occurredAtUtc: string
  openf1DateStart: string | null
}

export interface IntervalRow {
  driverId: number
  driverCode: string
  lapNumber: number
  gapToLeader: number | null
  intervalToAhead: number | null
}

export interface ResultRow {
  driverId: number
  driverCode: string
  position: number
  gridPosition: number | null
  lapsCompleted: number | null
  gapToLeader: string | null
  status: string
}

export interface SessionInfo {
  id: number
  sessionType: string
  sessionCode: string
  startTimeUtc: string
  grandPrixName: string
  season: number
  round: number
}

export interface TireStintRow {
  driverCode: string
  stintNumber: number
  compound: string
  lapStart: number
  lapEnd: number
  tyreAgeAtStart: number
}

export interface PitStopRow {
  driverCode: string
  lap: number
  stopNumber: number
  duration: string | null
}

export interface WeatherRow {
  airTemperature: number | null
  trackTemperature: number | null
  humidity: number | null
  rainfall: boolean
  windSpeed: number | null
  windDirection: number | null
  recordedAtUtc: string
}

interface SyncPanelProps {
  session: SessionInfo
  laps: LapRow[]
  intervals: IntervalRow[]
  results: ResultRow[]
  videoTime: number
  offsetSeconds: number
  loading?: boolean
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#d1d5db",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
}

function CompoundBadge({ compound }: { compound: string | null }) {
  if (!compound) return null
  const color = COMPOUND_COLORS[compound.toUpperCase()] ?? "#6b7280"
  return (
    <span
      className="inline-block w-3 h-3 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={compound}
    />
  )
}

interface DriverState {
  driverId: number
  driverCode: string
  driverNumber: number
  fullName: string
  teamColor: string
  lapNumber: number
  lapTime: string | null
  compound: string | null
  pitIn: boolean
  pitOut: boolean
  gapToLeader: number | null
  position: number | null
}

export function SyncPanel({ session, laps, intervals, results, videoTime, offsetSeconds, loading }: SyncPanelProps) {
  const driverStates = useMemo<DriverState[]>(() => {
    const sessionStartMs = new Date(session.startTimeUtc).getTime()
    const wallClockMs = sessionStartMs + (videoTime - offsetSeconds) * 1000

    const byDriver = new Map<number, LapRow>()
    for (const lap of laps) {
      const lapMs = new Date(lap.occurredAtUtc).getTime()
      if (lapMs > wallClockMs) continue
      const existing = byDriver.get(lap.driverId)
      if (!existing || lap.lapNumber > existing.lapNumber) {
        byDriver.set(lap.driverId, lap)
      }
    }

    const intervalByDriverLap = new Map<string, IntervalRow>()
    for (const row of intervals) {
      intervalByDriverLap.set(`${row.driverId}:${row.lapNumber}`, row)
    }

    const resultByDriver = new Map<number, ResultRow>()
    for (const r of results) {
      resultByDriver.set(r.driverId, r)
    }

    const states: DriverState[] = []

    for (const [driverId, lap] of byDriver) {
      const intervalKey = `${driverId}:${lap.lapNumber}`
      const interval = intervalByDriverLap.get(intervalKey)
      states.push({
        driverId,
        driverCode: lap.driverCode,
        driverNumber: lap.driverNumber,
        fullName: lap.fullName,
        teamColor: lap.teamColor,
        lapNumber: lap.lapNumber,
        lapTime: lap.lapTime,
        compound: lap.compound,
        pitIn: lap.pitIn,
        pitOut: lap.pitOut,
        gapToLeader: interval?.gapToLeader ?? null,
        position: null,
      })
    }

    if (states.some((s) => s.gapToLeader !== null)) {
      states.sort((a, b) => {
        if (a.gapToLeader === null && b.gapToLeader === null) return 0
        if (a.gapToLeader === null) return 1
        if (b.gapToLeader === null) return -1
        return a.gapToLeader - b.gapToLeader
      })
    } else {
      const resultOrder = new Map(results.map((r) => [r.driverId, r.position]))
      states.sort((a, b) => {
        const pa = resultOrder.get(a.driverId) ?? 99
        const pb = resultOrder.get(b.driverId) ?? 99
        return pa - pb
      })
    }

    states.forEach((s, i) => { s.position = i + 1 })

    return states
  }, [laps, intervals, results, session.startTimeUtc, videoTime, offsetSeconds])

  const currentLapNumber = useMemo(() => {
    if (driverStates.length === 0) return 0
    return Math.max(...driverStates.map((s) => s.lapNumber))
  }, [driverStates])

  const sessionMs = new Date(session.startTimeUtc).getTime()
  const wallClockMs = sessionMs + (videoTime - offsetSeconds) * 1000
  const relativeMin = Math.max(0, Math.floor((wallClockMs - sessionMs) / 60000))

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando dados de volta…
      </div>
    )
  }

  if (driverStates.length === 0) {
    return (
      <div className="text-center text-gray-500 text-xs py-6">
        {videoTime < offsetSeconds
          ? "Aguardando início da sessão…"
          : "Nenhum dado de volta disponível para este momento"}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-700">
        <span>
          {session.grandPrixName} — {session.sessionCode}
        </span>
        <span>
          Volta {currentLapNumber} · T+{relativeMin}m
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-[18px_42px_1fr_60px_36px_12px] gap-1 px-1 text-xs text-gray-500 pb-0.5">
          <span>P</span>
          <span>DRV</span>
          <span>Última volta</span>
          <span className="text-right">Gap</span>
          <span className="text-right">Volta</span>
          <span />
        </div>

        {driverStates.map((s) => (
          <div
            key={s.driverId}
            className="grid grid-cols-[18px_42px_1fr_60px_36px_12px] gap-1 items-center px-1 py-0.5 rounded hover:bg-gray-800/50"
          >
            <span className="text-xs text-gray-400">{s.position}</span>

            <span
              className="text-xs font-mono font-semibold"
              style={{ color: `#${s.teamColor.replace("#", "")}` }}
            >
              {s.driverCode}
            </span>

            <span className="text-xs text-gray-300 font-mono">
              {s.lapTime ?? "—"}
              {s.pitIn && <span className="ml-1 text-yellow-400 text-[10px]">PIT</span>}
              {s.pitOut && <span className="ml-1 text-green-400 text-[10px]">OUT</span>}
            </span>

            <span className="text-xs text-gray-400 font-mono text-right">
              {s.gapToLeader === null
                ? "—"
                : s.gapToLeader === 0
                  ? "leader"
                  : `+${s.gapToLeader.toFixed(3)}`}
            </span>

            <span className="text-xs text-gray-500 text-right">{s.lapNumber}</span>

            <CompoundBadge compound={s.compound} />
          </div>
        ))}
      </div>
    </div>
  )
}

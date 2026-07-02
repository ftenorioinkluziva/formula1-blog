"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMsToLapTime } from "@/lib/analytics/lap-time-parser"
import { buildDriverColorMap } from "@/lib/analytics/driver-colors"
import type { RacePaceResponse, RacePacePitStop, TireStintInfo, TeamRadioMessage } from "@/lib/analytics/types"

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "var(--tire-soft)",
  MEDIUM: "var(--tire-medium)",
  HARD: "var(--tire-hard)",
  INTERMEDIATE: "var(--tire-intermediate)",
  WET: "var(--tire-wet)",
}

const EVENT_COLORS = {
  SC:  { bg: "rgb(from var(--tire-medium) r g b / 12%)",  border: "var(--tire-medium)", text: "var(--tire-medium)",  label: "SAFETY CAR" },
  VSC: { bg: "rgb(from var(--stint-fallback-6) r g b / 12%)", border: "var(--stint-fallback-6)", text: "var(--stint-fallback-6)",  label: "VIRTUAL SC"  },
  RED: { bg: "rgb(from var(--telemetry-brake) r g b / 12%)",  border: "var(--telemetry-brake)", text: "var(--telemetry-brake)",  label: "RED FLAG"    },
}

type DriverFilter = "top5" | "top10" | "all"
const FILTER_OPTIONS: Array<{ value: DriverFilter; label: string }> = [
  { value: "top5",  label: "Top 5"  },
  { value: "top10", label: "Top 10" },
  { value: "all",   label: "All"    },
]

interface Props { season: number; round: number; locale: string }

interface RaceEventPeriod {
  type: "SC" | "VSC" | "RED"
  startLap: number
  endLap: number
}

const MAX_SELECTED_DRIVERS = 4

export function RacePaceChart({ season, round, locale }: Props) {
  const [data, setData]                     = useState<RacePaceResponse | null>(null)
  const [loading, setLoading]               = useState(true)
  const [filter, setFilter]                 = useState<DriverFilter>("top10")
  const [hideOutliers, setHideOutliers]     = useState(true)
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())
  const [showRadio, setShowRadio]           = useState(false)
  const [playingUrl, setPlayingUrl]         = useState<string | null>(null)

  const hasSelection = selectedDrivers.size > 0

  function toggleDriver(code: string) {
    setSelectedDrivers((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else if (next.size < MAX_SELECTED_DRIVERS) next.add(code)
      return next
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      setSelectedDrivers(new Set())
      fetch(`/${locale}/api/analytics/race-pace?season=${season}&round=${round}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, round, locale])

  const colorMap = useMemo(() => {
    if (!data) return new Map<string, string>()
    return buildDriverColorMap(data.drivers.map((d) => ({ code: d.code, teamColor: d.teamColor, teamName: d.teamName })))
  }, [data])

  const visibleDriverCodes = useMemo(() => {
    if (!data) return new Set<string>()
    if (hasSelection) return new Set(selectedDrivers)
    const limit = filter === "top5" ? 5 : filter === "top10" ? 10 : data.drivers.length
    return new Set(data.drivers.slice(0, limit).map((d) => d.code))
  }, [data, filter, selectedDrivers, hasSelection])

  const selectedDriverStops = useMemo((): RacePacePitStop[] => {
    if (!data || !hasSelection) return []
    return data.pitStops.filter((p) => selectedDrivers.has(p.driverCode))
  }, [data, selectedDrivers, hasSelection])

  const selectedDriverStints = useMemo((): TireStintInfo[] => {
    if (!data || !hasSelection) return []
    return data.stints.filter((s) => selectedDrivers.has(s.driverCode))
  }, [data, selectedDrivers, hasSelection])

  const raceEventPeriods = useMemo((): RaceEventPeriod[] => {
    const events = data?.raceControlEvents ?? []
    if (!events.length) return []
    const periods: RaceEventPeriod[] = []
    let current: "SC" | "VSC" | "RED" | null = null
    let startLap = 0
    for (const ev of events) {
      const msg = ev.message.toUpperCase()
      if (msg.includes("SAFETY CAR DEPLOYED") && !msg.includes("VIRTUAL")) {
        if (!current) { current = "SC";  startLap = ev.lap }
      } else if (msg.includes("VIRTUAL SAFETY CAR DEPLOYED") || msg === "VSC DEPLOYED") {
        if (!current) { current = "VSC"; startLap = ev.lap }
      } else if (msg === "RED FLAG" || msg.startsWith("RED FLAG ")) {
        if (!current) { current = "RED"; startLap = ev.lap }
      } else if (current && (msg.includes("GREEN LIGHT") || msg.includes("SAFETY CAR IN THIS LAP") || msg === "VSC ENDING")) {
        periods.push({ type: current, startLap, endLap: ev.lap })
        current = null
      }
    }
    if (current && data) periods.push({ type: current, startLap, endLap: data.totalLaps })
    return periods
  }, [data])

  // per-lap event type map for XAxis tick coloring
  const eventLapMap = useMemo((): Map<number, "SC" | "VSC" | "RED"> => {
    const map = new Map<number, "SC" | "VSC" | "RED">()
    for (const p of raceEventPeriods)
      for (let l = p.startLap; l <= p.endLap; l++) map.set(l, p.type)
    return map
  }, [raceEventPeriods])

  const filteredRadio = useMemo((): TeamRadioMessage[] => {
    if (!data || !showRadio) return []
    const radio = data.teamRadio ?? []
    return hasSelection ? radio.filter((r) => selectedDrivers.has(r.driverCode)) : radio
  }, [data, showRadio, hasSelection, selectedDrivers])

  const radioLaps = useMemo(() =>
    [...new Set(filteredRadio.filter((r) => r.lap !== null).map((r) => r.lap!))],
    [filteredRadio])

  const { chartData, pitStopLaps } = useMemo(() => {
    if (!data) return { chartData: [], pitStopLaps: [] as number[] }
    const lapTimes = data.laps.filter((l) => visibleDriverCodes.has(l.driverCode))
    let medianTime = 0
    if (hideOutliers && lapTimes.length > 0) {
      const sorted = [...lapTimes].map((l) => l.lapTimeMs).sort((a, b) => a - b)
      medianTime = sorted[Math.floor(sorted.length / 2)]
    }
    const byLap = new Map<number, Record<string, number>>()
    for (const lap of lapTimes) {
      if (hideOutliers) {
        if (lap.lapNumber === 1) continue
        if (lap.pitIn || lap.pitOut) continue
        if (medianTime > 0 && lap.lapTimeMs > medianTime * 1.15) continue
      }
      if (!byLap.has(lap.lapNumber)) byLap.set(lap.lapNumber, {})
      byLap.get(lap.lapNumber)![lap.driverCode] = lap.lapTimeMs / 1000
    }
    const laps = Array.from(byLap.entries()).sort(([a], [b]) => a - b).map(([lap, drv]) => ({ lap, ...drv }))
    const pitLaps = hasSelection
      ? selectedDriverStops.map((p) => p.lap)
      : [...new Set(data.pitStops.filter((p) => visibleDriverCodes.has(p.driverCode)).map((p) => p.lap))]
    return { chartData: laps, pitStopLaps: pitLaps }
  }, [data, visibleDriverCodes, hideOutliers, hasSelection, selectedDriverStops])

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading race pace data...</div>
  if (!data || !data.laps.length) return <div className="flex items-center justify-center h-64 text-muted-foreground/80">No race pace data available</div>

  const driverCodes = Array.from(visibleDriverCodes)
  const allLaps = Array.from({ length: data.totalLaps }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {!hasSelection && FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {hasSelection && (
          <button
            onClick={() => setSelectedDrivers(new Set())}
            className="px-3 py-1 text-xs rounded-full bg-red-600 text-foreground hover:bg-red-700 transition-colors"
          >
            Clear ({selectedDrivers.size}/{MAX_SELECTED_DRIVERS})
          </button>
        )}
        <button
          onClick={() => setHideOutliers(!hideOutliers)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            hideOutliers ? "bg-blue-600 text-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
          }`}
        >
          Hide outliers
        </button>
        {(data.teamRadio?.length ?? 0) > 0 && (
          <button
            onClick={() => { setShowRadio(!showRadio); setPlayingUrl(null) }}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              showRadio ? "bg-purple-600 text-foreground" : "bg-secondary text-foreground/80 hover:bg-secondary/80"
            }`}
          >
            Team Radio
          </button>
        )}
      </div>

      {/* ── Stint badges ─────────────────────────────────────── */}
      {hasSelection && (selectedDriverStints.length > 0 || selectedDriverStops.length > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {selectedDriverStints.length > 0
            ? selectedDriverStints.map((stint) => {
                const cc = COMPOUND_COLORS[stint.compound.toUpperCase()] ?? "var(--muted-foreground)"
                const isLight = stint.compound.toUpperCase() === "HARD"
                return (
                  <span
                    key={`${stint.driverCode}-${stint.stintNumber}`}
                    className={`px-2 py-1 rounded font-medium ${isLight ? "text-background/80" : "text-foreground/90"}`}
                    style={{ backgroundColor: cc, opacity: 0.8 }}
                  >
                    {stint.driverCode} {stint.compound.charAt(0).toUpperCase()}{stint.compound.slice(1).toLowerCase()} L{stint.lapStart}–{stint.lapEnd}
                  </span>
                )
              })
            : selectedDriverStops.map((stop) => (
                <span key={`${stop.driverCode}-${stop.stopNumber}`} className="bg-secondary text-foreground/80 px-2 py-1 rounded">
                  {stop.driverCode} Stop {stop.stopNumber} — Lap {stop.lap}
                  {stop.durationMs ? ` (${(stop.durationMs / 1000).toFixed(1)}s)` : ""}
                </span>
              ))}
        </div>
      )}

      {/* ── Race Event Pills ─────────────────────────────────── */}
      {raceEventPeriods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {raceEventPeriods.map((period, i) => {
            const cfg = EVENT_COLORS[period.type]
            const laps = period.endLap - period.startLap
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
                style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.text }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: cfg.border }}
                />
                <span className="tracking-wider font-bold">{cfg.label}</span>
                <span className="opacity-70 font-normal">
                  L{period.startLap}–{period.endLap}
                  {laps > 0 && ` · ${laps} lap${laps > 1 ? "s" : ""}`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 20, left: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="lap"
            type="number"
            domain={[1, data.totalLaps]}
            ticks={allLaps}
            stroke="var(--muted-foreground)"
            interval={(data.totalLaps > 30 ? 4 : 2)}
            tick={(props) => {
              const { x, y, payload } = props
              const evType = eventLapMap.get(payload.value)
              const fill = evType
                ? (evType === "RED" ? "var(--telemetry-brake)" : evType === "SC" ? "var(--tire-medium)" : "var(--stint-fallback-6)")
                : "var(--muted-foreground)"
              const bold = !!evType
              return (
                <text
                  x={x} y={y + 10}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={bold ? 700 : 400}
                  fill={fill}
                >
                  {payload.value}
                </text>
              )
            }}
            label={{ value: "Lap", position: "insideBottom", offset: -10, fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatMsToLapTime(v * 1000)}
            width={52}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const evType = eventLapMap.get(Number(label))
              const evSuffix = evType ? ` · ${EVENT_COLORS[evType].label}` : ""
              return (
                <div style={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: 12, padding: "8px 10px" }}>
                  <p style={{ color: "var(--muted-foreground)", marginBottom: 6 }}>{`Lap ${label}${evSuffix}`}</p>
                  {payload.map((entry) => (
                    <div key={entry.dataKey as string} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: (entry.color as string) ?? "var(--muted-foreground)", flexShrink: 0 }} />
                      <span style={{ color: "var(--muted-foreground)", minWidth: 32 }}>{entry.dataKey as string}</span>
                      <span style={{ color: "var(--foreground)", marginLeft: "auto", paddingLeft: 12 }}>{formatMsToLapTime((entry.value as number) * 1000)}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {/* Event boundary lines */}
          {raceEventPeriods.map((period, i) => {
            const cfg = EVENT_COLORS[period.type]
            return [
              <ReferenceLine key={`ev-start-${i}`} x={period.startLap} stroke={cfg.border} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.7} />,
              <ReferenceLine key={`ev-end-${i}`}   x={period.endLap}   stroke={cfg.border} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.4} />,
            ]
          })}
          {radioLaps.map((lap) => (
            <ReferenceLine key={`radio-${lap}`} x={lap} stroke="var(--telemetry-radio)" strokeDasharray="1 3" strokeWidth={1} />
          ))}
          {pitStopLaps.map((lap) => (
            <ReferenceLine
              key={`pit-${lap}`}
              x={lap}
              stroke={hasSelection ? "var(--telemetry-brake)" : "var(--muted-foreground)"}
              strokeDasharray="2 2"
              strokeWidth={hasSelection ? 1.5 : 1}
              label={hasSelection ? { value: "PIT", fill: "var(--telemetry-brake)", fontSize: 10, position: "top" } : undefined}
            />
          ))}
          {driverCodes.map((code) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              stroke={colorMap.get(code) ?? "var(--muted-foreground)"}
              dot={false}
              strokeWidth={hasSelection && selectedDrivers.has(code) ? 2.5 : 1.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* ── Driver legend ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs">
        {data.drivers
          .slice(0, filter === "top5" ? 5 : filter === "top10" ? 10 : data.drivers.length)
          .map((d) => d.code)
          .map((code) => (
            <button
              key={code}
              onClick={() => toggleDriver(code)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                selectedDrivers.has(code) ? "bg-secondary/80 ring-1 ring-muted-foreground" : "hover:bg-secondary"
              }`}
            >
              <span className="w-3 h-1 rounded" style={{ backgroundColor: colorMap.get(code) ?? "var(--muted-foreground)" }} />
              <span className="text-muted-foreground">{code}</span>
            </button>
          ))}
      </div>

      {/* ── XAxis color legend ────────────────────────────────── */}
      {raceEventPeriods.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground/80 border-t border-border pt-2">
          <span className="text-muted-foreground/60">Lap number color:</span>
          {(["SC", "VSC", "RED"] as const)
            .filter((t) => raceEventPeriods.some((p) => p.type === t))
            .map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="font-bold text-[11px]" style={{ color: EVENT_COLORS[t].border }}>12</span>
                <span>{EVENT_COLORS[t].label}</span>
              </span>
            ))}
        </div>
      )}

      {/* ── Team Radio ────────────────────────────────────────── */}
      {showRadio && filteredRadio.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-purple-400 font-medium">Team Radio ({filteredRadio.length} messages)</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredRadio.map((r, i) => (
              <button
                key={i}
                onClick={() => setPlayingUrl(playingUrl === r.recordingUrl ? null : r.recordingUrl)}
                className={`flex items-center gap-2 text-xs w-full text-left px-2 py-1 rounded transition-colors ${
                  playingUrl === r.recordingUrl ? "bg-purple-900/40" : "hover:bg-secondary/50"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.teamColor }} />
                <span className="text-muted-foreground w-10 shrink-0">{r.lap !== null ? `Lap ${r.lap}` : "—"}</span>
                <span className="text-foreground/80">{r.driverCode}</span>
                <span className="text-purple-400 ml-auto">{playingUrl === r.recordingUrl ? "■ Stop" : "▶ Play"}</span>
              </button>
            ))}
          </div>
          {playingUrl && (
            <audio key={playingUrl} src={playingUrl} autoPlay controls onEnded={() => setPlayingUrl(null)} className="w-full h-8 mt-1" />
          )}
        </div>
      )}

      {!hasSelection && (
        <p className="text-[10px] text-muted-foreground/60">Click up to {MAX_SELECTED_DRIVERS} drivers to compare pace and pit stops</p>
      )}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMsToLapTime } from "@/lib/analytics/lap-time-parser"
import type { PoleXRayResponse, TelemetrySample } from "@/lib/analytics/types"

interface Props {
  season: number
  round: number
  locale: string
}

export function PoleXRayChart({ season, round, locale }: Props) {
  const [data, setData] = useState<PoleXRayResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetch(`/${locale}/api/analytics/pole-xray?season=${season}&round=${round}`)
        .then((r) => {
          if (!r.ok) throw new Error("fetch failed")
          return r.json()
        })
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [season, round, locale])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground/80">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading telemetry</span>
        </div>
      </div>
    )
  }

  if (!data || data.telemetry.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground/60 font-mono text-sm">
        NO TELEMETRY — OpenF1 data available from 2023+
      </div>
    )
  }

  return <PoleXRayInner data={data} round={round} locale={locale} />
}

function PoleXRayInner({ data, round, locale }: { data: PoleXRayResponse; round: number; locale: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)
  const [currentMs, setCurrentMs] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVideoSrc(null)
      setVideoLoading(true)
      setCurrentMs(null)
      setIsPlaying(false)
      fetch(`/${locale}/api/analytics/pole-video?season=2026&round=${round}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { url: string } | null) => setVideoSrc(d?.url ?? null))
        .catch(() => setVideoSrc(null))
        .finally(() => setVideoLoading(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [round, locale])

  const totalTelemetryMs = useMemo(() => {
    const last = data.telemetry[data.telemetry.length - 1]
    return last?.relativeMs ?? null
  }, [data.telemetry])

  const activeSample = useMemo((): TelemetrySample | null => {
    if (currentMs === null) return null
    const hasRelative = data.telemetry[0]?.relativeMs !== null
    if (hasRelative) {
      let closest = data.telemetry[0]
      let minDiff = Math.abs((closest.relativeMs ?? 0) - currentMs)
      for (const s of data.telemetry) {
        if (s.relativeMs === null) continue
        const diff = Math.abs(s.relativeMs - currentMs)
        if (diff < minDiff) {
          minDiff = diff
          closest = s
        }
      }
      return closest
    }
    if (totalTelemetryMs === null) return null
    const ratio = currentMs / totalTelemetryMs
    const idx = Math.round(ratio * (data.telemetry.length - 1))
    return data.telemetry[Math.max(0, Math.min(idx, data.telemetry.length - 1))]
  }, [currentMs, totalTelemetryMs, data.telemetry])

  const activeSampleIndex = activeSample?.sampleIndex ?? null

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    setCurrentMs(videoRef.current.currentTime * 1000)
  }, [])

  const handlePlay = useCallback(() => setIsPlaying(true), [])
  const handlePause = useCallback(() => setIsPlaying(false), [])

  const handleChartClick = useCallback(
    (sampleIndex: number) => {
      if (!videoRef.current || totalTelemetryMs === null) return
      const sample = data.telemetry.find((s) => s.sampleIndex === sampleIndex)
      if (!sample) return
      const targetMs =
        sample.relativeMs !== null
          ? sample.relativeMs
          : (sampleIndex / (data.telemetry.length - 1)) * totalTelemetryMs
      videoRef.current.currentTime = targetMs / 1000
      setCurrentMs(targetMs)
    },
    [data.telemetry, totalTelemetryMs],
  )

  const teamColor = data.teamColor || "var(--primary)"
  const progressPct =
    currentMs !== null && totalTelemetryMs
      ? Math.min(100, (currentMs / totalTelemetryMs) * 100)
      : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: teamColor }}
          />
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-foreground font-mono font-bold text-lg tracking-tight">
                {data.driverCode}
              </span>
              <span className="text-muted-foreground text-sm">{data.driverFullName}</span>
            </div>
            <div className="text-xs text-muted-foreground/60 font-mono uppercase tracking-wider">Pole Position</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.lapTimeMs && (
            <TimeBadge label="LAP" value={formatMsToLapTime(data.lapTimeMs)} accent={teamColor} large />
          )}
          {data.sector1Ms && <TimeBadge label="S1" value={formatMsToLapTime(data.sector1Ms)} />}
          {data.sector2Ms && <TimeBadge label="S2" value={formatMsToLapTime(data.sector2Ms)} />}
          {data.sector3Ms && <TimeBadge label="S3" value={formatMsToLapTime(data.sector3Ms)} />}
        </div>
      </div>

      {/* Main split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4">
        {/* Left: video + live readout */}
        <div className="flex flex-col gap-3">
          {/* Video */}
          {videoLoading && (
            <div className="rounded-lg border border-border bg-background flex items-center justify-center h-24">
              <span className="text-muted-foreground/60 font-mono text-xs tracking-widest uppercase">Checking video…</span>
            </div>
          )}

          {!videoLoading && videoSrc && (
            <div
              className="relative rounded-lg overflow-hidden bg-background"
              style={{ boxShadow: `0 0 0 1px ${teamColor}22, 0 4px 24px rgba(0,0,0,0.6)` }}
            >
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full block"
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
              />
              <div className="h-0.5 bg-card">
                <div
                  className="h-full transition-none"
                  style={{ width: `${progressPct}%`, backgroundColor: teamColor }}
                />
              </div>
            </div>
          )}

          {!videoLoading && !videoSrc && (
            <div className="rounded-lg border border-dashed border-border bg-background/50 flex items-center justify-center h-24">
              <span className="text-muted-foreground/60 font-mono text-xs tracking-widest uppercase">
                No pole lap video for round {round}
              </span>
            </div>
          )}

          {/* Live telemetry readout */}
          <div
            className="rounded-lg border border-border bg-background p-3 grid grid-cols-2 gap-2"
          >
            <LiveGauge
              label="SPEED"
              value={activeSample?.speed ?? null}
              unit="km/h"
              max={380}
              color={teamColor}
            />
            <LiveGauge
              label="RPM"
              value={activeSample?.rpm ?? null}
              unit="rpm"
              max={12000}
              color="var(--telemetry-rpm)"
            />
            <LiveGauge
              label="THROTTLE"
              value={activeSample?.throttle ?? null}
              unit="%"
              max={100}
              color="var(--telemetry-throttle)"
            />
            <LiveGauge
              label="BRAKE"
              value={activeSample?.brake ?? null}
              unit="%"
              max={100}
              color="var(--telemetry-brake)"
            />
            <div className="col-span-2 flex items-center justify-between px-2 py-1.5 rounded bg-card/60">
              <span className="text-muted-foreground/80 font-mono text-xs tracking-widest">GEAR</span>
              <span className="font-mono font-bold text-2xl text-foreground tabular-nums">
                {activeSample?.gear ?? "–"}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-mono tracking-widest uppercase"
                  style={{ color: activeSample?.drs ? "var(--telemetry-throttle)" : "var(--muted-foreground)" }}
                >
                  DRS
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: activeSample?.drs ? "var(--telemetry-throttle)" : "var(--secondary)",
                    boxShadow: activeSample?.drs ? "0 0 6px var(--telemetry-throttle)" : "none",
                  }}
                />
              </div>
            </div>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-2 justify-center">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: teamColor }}
              />
              <span className="text-xs font-mono tracking-widest uppercase text-muted-foreground/80">
                Telemetry sync active
              </span>
            </div>
          )}
        </div>

        {/* Right: charts */}
        <div ref={chartsRef} className="flex flex-col gap-1 min-w-0">
          <ChartPanel label="SPEED TRACE" unit="km/h">
            <SpeedTrace data={data} activeSampleIndex={activeSampleIndex} onChartClick={handleChartClick} teamColor={teamColor} />
          </ChartPanel>
          <ChartPanel label="THROTTLE / BRAKE" unit="%">
            <InputsTrace data={data} activeSampleIndex={activeSampleIndex} onChartClick={handleChartClick} />
          </ChartPanel>
          <ChartPanel label="GEAR" unit="">
            <GearTrace data={data} activeSampleIndex={activeSampleIndex} onChartClick={handleChartClick} />
          </ChartPanel>
        </div>
      </div>
    </div>
  )
}

function TimeBadge({
  label,
  value,
  accent,
  large,
}: {
  label: string
  value: string
  accent?: string
  large?: boolean
}) {
  return (
    <div
      className="flex flex-col items-center px-3 py-1.5 rounded-md bg-card border border-border"
      style={accent ? { borderColor: `${accent}44` } : {}}
    >
      <span className="text-muted-foreground/80 font-mono text-[10px] tracking-widest uppercase">{label}</span>
      <span
        className={`font-mono font-semibold tabular-nums ${large ? "text-base text-foreground" : "text-sm text-foreground/90"}`}
        style={accent && large ? { color: accent } : {}}
      >
        {value}
      </span>
    </div>
  )
}

function LiveGauge({
  label,
  value,
  unit,
  max,
  color,
}: {
  label: string
  value: number | null
  unit: string
  max: number
  color: string
}) {
  const pct = value !== null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded bg-card/60">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground/80 font-mono text-[10px] tracking-widest">{label}</span>
        <span className="font-mono font-bold text-sm text-foreground tabular-nums">
          {value !== null ? value.toLocaleString() : "–"}
          <span className="text-muted-foreground/60 text-[10px] ml-0.5">{unit}</span>
        </span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-none"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ChartPanel({
  label,
  unit,
  children,
}: {
  label: string
  unit: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground/60 uppercase">{label}</span>
        {unit && <span className="text-[10px] font-mono text-muted-foreground/50">{unit}</span>}
      </div>
      {children}
    </div>
  )
}

interface TraceProps {
  data: PoleXRayResponse
  activeSampleIndex: number | null
  onChartClick: (sampleIndex: number) => void
  teamColor?: string
}

const CHART_STYLE = {
  backgroundColor: "transparent",
  cursor: "crosshair",
} as const

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  fontSize: 11,
  fontFamily: "monospace",
} as const

function SpeedTrace({ data, activeSampleIndex, onChartClick, teamColor = "var(--primary)" }: TraceProps) {
  const drsZones = useMemo(() => {
    const zones: Array<{ start: number; end: number }> = []
    let zoneStart: number | null = null
    for (const sample of data.telemetry) {
      if (sample.drs > 0 && zoneStart === null) {
        zoneStart = sample.sampleIndex
      } else if (sample.drs === 0 && zoneStart !== null) {
        zones.push({ start: zoneStart, end: sample.sampleIndex })
        zoneStart = null
      }
    }
    if (zoneStart !== null) {
      zones.push({ start: zoneStart, end: data.telemetry[data.telemetry.length - 1].sampleIndex })
    }
    return zones
  }, [data.telemetry])

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={data.telemetry}
        margin={{ top: 2, right: 8, bottom: 4, left: -10 }}
        onClick={(e) => {
          if (e?.activePayload?.[0]) onChartClick((e.activePayload[0].payload as TelemetrySample).sampleIndex)
        }}
        style={CHART_STYLE}
      >
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
        <XAxis dataKey="sampleIndex" stroke="var(--border)" tick={false} height={4} />
        <YAxis stroke="var(--border)" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} domain={[0, "auto"]} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => [`${v} km/h`, "Speed"]}
          labelFormatter={(l) => `#${l}`}
        />
        {drsZones.map((zone, i) => (
          <ReferenceArea key={i} x1={zone.start} x2={zone.end} fill="var(--telemetry-throttle)" fillOpacity={0.08} />
        ))}
        <Line type="monotone" dataKey="speed" stroke={teamColor} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        {activeSampleIndex !== null && (
          <ReferenceLine x={activeSampleIndex} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

function InputsTrace({ data, activeSampleIndex, onChartClick }: TraceProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={data.telemetry}
        margin={{ top: 2, right: 8, bottom: 4, left: -10 }}
        onClick={(e) => {
          if (e?.activePayload?.[0]) onChartClick((e.activePayload[0].payload as TelemetrySample).sampleIndex)
        }}
        style={CHART_STYLE}
      >
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
        <XAxis dataKey="sampleIndex" stroke="var(--border)" tick={false} height={4} />
        <YAxis stroke="var(--border)" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} domain={[0, 100]} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, n: string) => [`${v}%`, n === "throttle" ? "Throttle" : "Brake"]}
        />
        <Area type="monotone" dataKey="throttle" stroke="var(--telemetry-throttle)" fill="var(--telemetry-throttle)" fillOpacity={0.2} dot={false} strokeWidth={1} isAnimationActive={false} />
        <Area type="monotone" dataKey="brake" stroke="var(--telemetry-brake)" fill="var(--telemetry-brake)" fillOpacity={0.2} dot={false} strokeWidth={1} isAnimationActive={false} />
        {activeSampleIndex !== null && (
          <ReferenceLine x={activeSampleIndex} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function GearTrace({ data, activeSampleIndex, onChartClick }: TraceProps) {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <LineChart
        data={data.telemetry}
        margin={{ top: 2, right: 8, bottom: 4, left: -10 }}
        onClick={(e) => {
          if (e?.activePayload?.[0]) onChartClick((e.activePayload[0].payload as TelemetrySample).sampleIndex)
        }}
        style={CHART_STYLE}
      >
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
        <XAxis dataKey="sampleIndex" stroke="var(--border)" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} height={14} />
        <YAxis stroke="var(--border)" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} domain={[1, 8]} ticks={[1,2,3,4,5,6,7,8]} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => [`Gear ${v}`, ""]}
          labelFormatter={(l) => `#${l}`}
        />
        <Line type="stepAfter" dataKey="gear" stroke="var(--telemetry-rpm)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        {activeSampleIndex !== null && (
          <ReferenceLine x={activeSampleIndex} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

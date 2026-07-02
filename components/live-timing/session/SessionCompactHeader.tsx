"use client"

import { useLiveTiming } from "../LiveTimingProvider"
import { formatLapTime, parseLapTimeToMs } from "@/lib/live-timing/formatters"

const TRACK_STATUS_LABEL: Record<string, string> = {
  AllClear: "PISTA LIVRE",
  Yellow: "BANDEIRA AMARELA",
  SCDeployed: "SAFETY CAR",
  VSCDeployed: "VIRTUAL SC",
  Red: "BANDEIRA VERMELHA",
}

const TRACK_STATUS_COLOR: Record<string, string> = {
  AllClear: "text-green-400",
  Yellow: "text-yellow-400",
  SCDeployed: "text-orange-400",
  VSCDeployed: "text-orange-300",
  Red: "text-red-400",
}

function getSessionStatusLabel(status?: string): string {
  const normalizedStatus = status?.trim().toLowerCase()

  if (normalizedStatus === "started") return "AO VIVO"
  if (normalizedStatus === "inactive") return "AGUARDANDO"
  if (normalizedStatus === "finalised" || normalizedStatus === "finished") return "ENCERRADA"
  if (normalizedStatus === "aborted") return "INTERROMPIDA"
  if (normalizedStatus === "scheduled") return "PROGRAMADA"

  return status || "AGUARDANDO"
}

function getTrackStatusLabel(message?: string): string {
  if (!message) return "AGUARDANDO"
  return TRACK_STATUS_LABEL[message] ?? message.toUpperCase()
}

function getTrackStatusColor(message?: string): string {
  if (!message) return "text-muted-foreground"
  return TRACK_STATUS_COLOR[message] ?? "text-foreground/80"
}

export function SessionCompactHeader() {
  const { timingStats, weather, trackStatus, session, sessionState } = useLiveTiming()

  if (!timingStats || !session) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground/80">Dados da sessão indisponíveis</p>
      </div>
    )
  }

  const idealLapValues = [
    timingStats.bestSectors.sector1,
    timingStats.bestSectors.sector2,
    timingStats.bestSectors.sector3,
  ].map((value) => parseLapTimeToMs(value))

  const idealLapMs = idealLapValues.some((value) => value === null)
    ? null
    : idealLapValues.reduce((sum: number, value: number | null) => sum + (value ?? 0), 0)

  const idealLap = idealLapMs ? formatLapTime(idealLapMs) : "—"
  const airTemp = weather?.airTemp ? `${weather.airTemp}°C` : "—"
  const trackTemp = weather?.trackTemp ? `${weather.trackTemp}°C` : "—"
  const humidity = weather?.humidity ? `${weather.humidity}%` : "—"
  const windSpeed = weather?.windSpeed ? `${weather.windSpeed} m/s` : "—"
  const rainfall = weather?.rainfall && weather.rainfall !== "0" ? `${weather.rainfall}mm` : "Nenhuma"
  const windDirection = weather?.windDirection ?? "0"
  const sessionName = (session.type || session.name || "Sessão").toUpperCase()
  const sessionPart = session.part ? `Q${session.part}` : null
  const remaining = sessionState?.remaining ?? "—"
  const statusLabel = getSessionStatusLabel(sessionState?.status)
  const isLive = statusLabel === "AO VIVO"
  const trackStatusLabel = getTrackStatusLabel(trackStatus?.message)
  const trackStatusColor = getTrackStatusColor(trackStatus?.message)

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-none">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? "text-red-500" : "text-muted-foreground/80"}`}>
            {statusLabel}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">{sessionName}</span>
          {sessionPart ? <span className="text-[10px] font-bold text-red-500">{sessionPart}</span> : null}
          <span className="text-[10px] text-muted-foreground/80 truncate max-w-45 sm:max-w-none">{session.circuit} · {session.country}</span>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-[10px] text-muted-foreground/80">RESTANTE</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{remaining}</span>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-[10px] text-muted-foreground/80">PISTA</span>
          <span className={`text-xs font-semibold uppercase tracking-normal ${trackStatusColor}`}>{trackStatusLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-none">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ideal Lap</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{idealLap}</span>
          <span className="text-[10px] text-muted-foreground/80">S1</span>
          <span className="text-xs font-semibold text-green-400 tabular-nums">{timingStats.bestSectors.sector1}</span>
          <span className="text-[10px] text-muted-foreground/80">S2</span>
          <span className="text-xs font-semibold text-green-400 tabular-nums">{timingStats.bestSectors.sector2}</span>
          <span className="text-[10px] text-muted-foreground/80">S3</span>
          <span className="text-xs font-semibold text-green-400 tabular-nums">{timingStats.bestSectors.sector3}</span>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-[10px] text-muted-foreground/80">Ar</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">{airTemp}</span>
          <span className="text-[10px] text-muted-foreground/80">Pista</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">{trackTemp}</span>
          <span className="text-[10px] text-muted-foreground/80">Umidade</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">{humidity}</span>
          <span className="text-[10px] text-muted-foreground/80">Vento</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">{windSpeed}</span>
          <span className="text-xs text-muted-foreground" style={{ transform: `rotate(${windDirection}deg)`, display: "inline-block" }}>↑</span>
          <span className="text-[10px] text-muted-foreground/80">Chuva</span>
          <span className="text-xs font-semibold text-foreground">{rainfall}</span>
        </div>
      </div>
    </div>
  )
}

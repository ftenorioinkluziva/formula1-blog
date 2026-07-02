"use client"

import { useLiveTiming } from "../LiveTimingProvider"

interface TrackStatusBannerProps {
  compact?: boolean
}

const TRACK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "1": { label: "PISTA LIVRE", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  "2": { label: "BANDEIRA AMARELA", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  "3": { label: "SAFETY CAR", color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  "4": { label: "BANDEIRA VERMELHA", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  "5": { label: "VIRTUAL SC", color: "text-orange-300", bg: "bg-orange-400/20 border-orange-400/30" },
  "6": { label: "VSC ENDING", color: "text-orange-200", bg: "bg-orange-300/20 border-orange-300/30" },
  "7": { label: "SC ENDING", color: "text-orange-300", bg: "bg-orange-400/20 border-orange-400/30" },
}

const MESSAGE_TO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  AllClear: { label: "PISTA LIVRE", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  Yellow: { label: "BANDEIRA AMARELA", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  SCDeployed: { label: "SAFETY CAR", color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  SafetyCar: { label: "SAFETY CAR", color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  Red: { label: "BANDEIRA VERMELHA", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  VSCDeployed: { label: "VIRTUAL SC", color: "text-orange-300", bg: "bg-orange-400/20 border-orange-400/30" },
  VSCEnding: { label: "VSC ENDING", color: "text-orange-200", bg: "bg-orange-300/20 border-orange-300/30" },
  SCEnding: { label: "SC ENDING", color: "text-orange-300", bg: "bg-orange-400/20 border-orange-400/30" },
}

export function TrackStatusBanner({ compact = false }: TrackStatusBannerProps) {
  const { trackStatus } = useLiveTiming()

  if (!trackStatus || trackStatus.status === "1" || trackStatus.message === "AllClear") {
    return null
  }

  const messageConfig = MESSAGE_TO_STATUS[trackStatus.message]
  const statusConfig = TRACK_STATUS_CONFIG[trackStatus.status]

  const config = messageConfig 
    ? messageConfig
    : statusConfig || {
        label: trackStatus.message.toUpperCase(),
        color: "text-muted-foreground",
        bg: "bg-secondary border-border",
      }

  return (
    <div
      className={`border rounded-lg ${config.bg} ${compact ? "px-3 py-1.5" : "px-4 py-2"} animate-in fade-in slide-in-from-top-2 duration-300`}
    >
      <div className="flex items-center justify-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")} animate-pulse`} />
        <span className={`${config.color} font-bold uppercase tracking-wide ${compact ? "text-xs" : "text-sm"}`}>
          {config.label}
        </span>
      </div>
    </div>
  )
}

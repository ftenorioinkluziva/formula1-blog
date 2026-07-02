"use client"

import { Play, Trash2, Clock, HardDrive } from "lucide-react"
import type { RecordingMetadata } from "@/lib/live-timing/recording/types"

interface ReplaySessionCardProps {
  recording: RecordingMetadata
  onPlay: (sessionKey: string) => void
  onDelete: (sessionKey: string) => void
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ReplaySessionCard({ recording, onPlay, onDelete }: ReplaySessionCardProps) {
  const displayName = recording.sessionKey.replace(/_/g, ' ')

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-sm px-4 py-3 hover:border-foreground/20 transition-colors">
      <button
        onClick={() => onPlay(recording.sessionKey)}
        className="shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
      >
        <Play className="w-4 h-4 text-primary ml-0.5" />
      </button>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-foreground truncate">{displayName}</h4>
        <p className="text-[10px] text-muted-foreground">{formatDate(recording.startedAt)}</p>
      </div>

      <div className="hidden sm:flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(recording.durationMs)}
        </span>
        <span>{recording.messageCount.toLocaleString()} msgs</span>
        <span className="flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          {formatSize(recording.fileSize)}
        </span>
      </div>

      <button
        onClick={() => onDelete(recording.sessionKey)}
        className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Delete recording"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

"use client"

import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { useReplayControls } from "@/components/live-timing/ReplayTimingProvider"
import type { PlaybackSpeed } from "@/lib/live-timing/recording/types"

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 5, 10]

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ReplayControls() {
  const {
    speed, setSpeed, isPaused, togglePause, seek,
    currentTs, startTs, endTs, events, progress,
  } = useReplayControls()

  const elapsed = currentTs - startTs
  const total = endTs - startTs

  return (
    <div className="bg-card border border-border rounded-sm px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => seek(startTs)}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Restart"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePause}
          className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
          aria-label={isPaused ? "Play" : "Pause"}
        >
          {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
        </button>

        <button
          onClick={() => seek(endTs)}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip to end"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 ml-2">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {formatTime(elapsed)} / {formatTime(total)}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={startTs}
          max={endTs}
          value={currentTs}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
        />

        <div className="absolute top-0 left-0 right-0 h-1.5 pointer-events-none">
          {events.map((event, i) => {
            const pos = total > 0 ? ((event.ts - startTs) / total) * 100 : 0
            return (
              <div
                key={i}
                className="absolute top-0 w-1 h-1.5 rounded-full"
                style={{ left: `${pos}%`, backgroundColor: event.color }}
                title={event.label}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

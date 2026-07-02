"use client"

import { useEffect, useState } from "react"
import { Lock, Timer } from "lucide-react"
import type { FantasyLockStatus } from "@/lib/fantasy/types"

interface Props {
  lockStatus: FantasyLockStatus | undefined
  lockAt: string | null | undefined
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "00:00"
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function FantasyLockCountdown({ lockStatus, lockAt }: Props) {
  const [now, setNow] = useState(() => Date.now())

  const deadline = lockAt ? new Date(lockAt).getTime() : null
  const isOpen = lockStatus === "open" || lockStatus === "closing_soon"
  const shouldTick = isOpen && deadline !== null && deadline > now

  useEffect(() => {
    if (!shouldTick) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [shouldTick])

  if (!isOpen || !deadline) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center justify-between text-zinc-500">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Lock</span>
          <Lock className="h-4 w-4" />
        </div>
        <div className="mt-2 text-lg font-semibold text-zinc-100">{lockStatus ?? "..."}</div>
      </div>
    )
  }

  const remaining = deadline - now
  const isUrgent = remaining > 0 && remaining < 30 * 60 * 1000

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isUrgent ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/70"}`}>
      <div className={`flex items-center justify-between ${isUrgent ? "text-amber-400" : "text-zinc-500"}`}>
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">Lock in</span>
        <Timer className={`h-4 w-4 ${isUrgent ? "animate-pulse" : ""}`} />
      </div>
      <div className={`mt-2 font-mono text-lg font-semibold tabular-nums ${isUrgent ? "text-amber-200" : "text-zinc-100"}`}>
        {remaining > 0 ? formatCountdown(remaining) : "closing..."}
      </div>
    </div>
  )
}

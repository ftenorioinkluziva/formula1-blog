"use client"

import { useMemo } from "react"
import type { SessionState } from "@/lib/live-timing/types"

export function useSessionCountdown(sessionState: SessionState | null): string {
  return useMemo(() => {
    return formatApiRemaining(sessionState?.remaining)
  }, [sessionState?.remaining])
}

function formatApiRemaining(raw?: string): string {
  if (!raw || raw === "—") return "00:00:00"
  const normalized = raw.trim()

  const hms = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/)
  if (hms) {
    return `${hms[1].padStart(2, "0")}:${hms[2]}:${hms[3]}`
  }

  const ms = normalized.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/)
  if (ms) {
    return `00:${ms[1].padStart(2, "0")}:${ms[2]}`
  }

  return "00:00:00"
}

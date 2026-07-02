export function parseLapTimeToMs(time: string | null | undefined): number | null {
  if (!time || time === "—") return null

  const trimmed = time.trim()

  const mmssMatch = trimmed.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (mmssMatch) {
    const minutes = parseInt(mmssMatch[1], 10)
    const seconds = parseFloat(mmssMatch[2])
    return Math.round((minutes * 60 + seconds) * 1000)
  }

  const ssMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/)
  if (ssMatch) {
    return Math.round(parseFloat(ssMatch[1]) * 1000)
  }

  return null
}

export function parseDurationToMs(duration: string | null | undefined): number | null {
  return parseLapTimeToMs(duration)
}

export function formatMsToLapTime(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60

  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`
  }

  return seconds.toFixed(3)
}

export function parseGapToSeconds(gap: string | null | undefined): number | null {
  if (!gap) return null

  const trimmed = gap.trim()

  if (/lap/i.test(trimmed)) return null

  const numMatch = trimmed.match(/^[+]?(\d+(?:\.\d+)?)$/)
  if (numMatch) {
    return parseFloat(numMatch[1])
  }

  return null
}

const DNF_FINISHED_STATUSES = new Set(["finished", "lapped"])

export function isDnf(status: string): boolean {
  const lower = status.toLowerCase()
  return !DNF_FINISHED_STATUSES.has(lower) && !lower.startsWith("+")
}

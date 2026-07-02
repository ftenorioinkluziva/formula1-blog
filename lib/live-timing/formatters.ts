export function parseLapTimeToMs(value: string | undefined): number | null {
  if (!value || value === "-" || value === "—") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (!trimmed.includes(":")) {
    const secondsOnly = Number(trimmed)
    if (!Number.isFinite(secondsOnly)) return null
    return Math.round(secondsOnly * 1000)
  }

  const [minPart, secPart] = trimmed.split(":")
  if (!secPart) return null

  const minutes = Number(minPart)
  const seconds = Number(secPart)
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return Math.round((minutes * 60 + seconds) * 1000)
}

export function formatGapMs(diffMs: number): string {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "0.000"
  return (diffMs / 1000).toFixed(3)
}

export function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = (totalSeconds % 60).toFixed(3)
  return `${minutes}:${seconds.padStart(6, "0")}`
}

export function toNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function normalizeEntries<T>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === "object" && raw !== null) {
    return Object.values(raw).filter(Boolean) as T[]
  }
  return []
}

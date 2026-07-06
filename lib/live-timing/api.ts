import type { F1LiveTimingRawState } from "./types"

const SUPPORTED_LOCALES = new Set(["pt", "en", "es"])
const CLIENT_RESPONSE_CACHE_MS = 250
const STALE_DATA_MAX_AGE_MS = 30_000
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 10_000
const NO_SESSION_BACKOFF_MS = 24 * 60 * 60 * 1000 // 24 hours — no session within 1 hour window
const NEXT_SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check for upcoming session every 5 minutes

let inFlightRequest: Promise<F1LiveTimingRawState | null> | null = null
let lastResolvedData: F1LiveTimingRawState | null = null
let lastResolvedAt = 0
let unavailableRetryCount = 0
let unavailableBackoffUntil = 0
let noSessionBackoffUntil = 0
let lastNextSessionCheckAt = 0
let cachedNextSession: { minutesUntil: number; hasUpcomingSession: boolean } | null = null

function isTemporaryUnavailable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function registerUnavailable(now: number): void {
  unavailableRetryCount += 1
  const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (unavailableRetryCount - 1))
  unavailableBackoffUntil = now + delay
}

function clearUnavailable(): void {
  unavailableRetryCount = 0
  unavailableBackoffUntil = 0
}

function getLocalizedApiPath(): string {
  if (typeof window === "undefined") return "/api/live-timing"

  const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0]
  if (firstPathSegment && SUPPORTED_LOCALES.has(firstPathSegment)) {
    return `/${firstPathSegment}/api/live-timing`
  }

  return "/api/live-timing"
}

function getLocalizedNextSessionPath(): string {
  if (typeof window === "undefined") return "/api/next-session"

  const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0]
  if (firstPathSegment && SUPPORTED_LOCALES.has(firstPathSegment)) {
    return `/${firstPathSegment}/api/next-session`
  }

  return "/api/next-session"
}

export async function shouldPollLiveTiming(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  const now = Date.now()

  // Check cache first
  if (cachedNextSession && now - lastNextSessionCheckAt <= NEXT_SESSION_CHECK_INTERVAL_MS) {
    return cachedNextSession.hasUpcomingSession
  }

  try {
    const response = await fetch(getLocalizedNextSessionPath(), {
      method: "GET",
      cache: "no-store",
    })

    if (response.ok) {
      const data = await response.json()
      cachedNextSession = {
        hasUpcomingSession: data.hasUpcomingSession,
        minutesUntil: data.minutesUntil,
      }
      lastNextSessionCheckAt = now

      if (data.hasUpcomingSession) {
        // Reset no-session backoff when we find an upcoming session
        noSessionBackoffUntil = 0
        return true
      }

      return false
    }
  } catch (error) {
    console.warn("[fetchLiveTiming] Failed to check next session:", error)
  }

  // If check failed, return cached value or default to false
  return cachedNextSession?.hasUpcomingSession ?? false
}

export async function fetchLiveTiming(): Promise<F1LiveTimingRawState | null> {
  if (typeof window === 'undefined') {
    return null
  }

  // Check if there's an upcoming session within the 1-hour window
  const shouldPoll = await shouldPollLiveTiming()
  if (!shouldPoll) {
    // No upcoming session — apply aggressive backoff
    const now = Date.now()
    if (now < noSessionBackoffUntil) {
      if (lastResolvedData && now - lastResolvedAt <= STALE_DATA_MAX_AGE_MS) {
        return lastResolvedData
      }
      return null
    }
    // Mark that we should backoff until next check
    noSessionBackoffUntil = now + NO_SESSION_BACKOFF_MS
    return null
  }

  const now = Date.now()
  if (lastResolvedData && now - lastResolvedAt <= CLIENT_RESPONSE_CACHE_MS) {
    return lastResolvedData
  }

  if (unavailableBackoffUntil > now) {
    if (lastResolvedData && now - lastResolvedAt <= STALE_DATA_MAX_AGE_MS) {
      return lastResolvedData
    }
    return null
  }

  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = (async () => {
    try {
      const internalResponse = await fetch(getLocalizedApiPath(), {
        method: "GET",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      })

      if (internalResponse.ok) {
        const payload = await internalResponse.json()
        if (payload?.data) {
          const data = payload.data as F1LiveTimingRawState
          lastResolvedData = data
          lastResolvedAt = Date.now()
          clearUnavailable()
          return data
        }
      }

      if (isTemporaryUnavailable(internalResponse.status)) {
        registerUnavailable(Date.now())
        if (lastResolvedData && Date.now() - lastResolvedAt <= STALE_DATA_MAX_AGE_MS) {
          return lastResolvedData
        }
        return null
      }

      registerUnavailable(Date.now())
      return null
    } catch {
      registerUnavailable(Date.now())
      return null
    } finally {
      inFlightRequest = null
    }
  })()

  return inFlightRequest
}

"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { LiveTimingState } from "@/lib/live-timing/types"
import { fetchLiveTiming, shouldPollLiveTiming } from "@/lib/live-timing/api"
import {
  parseDriverData,
  parseWeatherData,
  parseSessionInfo,
  parseSessionState,
  parseLiveTimingClock,
  parseTrackStatus,
  parseRaceMessages,
  parseRadioCaptures,
  buildDriverInfoMap,
  parseLapCount,
  parsePositionData,
  parseTimingStats,
  parseDriverTimingStats,
  parseTopThree,
} from "@/lib/live-timing/parsers"
import { POLLING_INTERVAL } from "@/lib/live-timing/constants"

export interface LiveTimingContextType extends LiveTimingState {
  setSelectedDriver: (racingNumber: string | null) => void
}

export const LiveTimingContext = createContext<LiveTimingContextType | null>(null)

interface LiveTimingProviderProps {
  children: ReactNode
  pollingInterval?: number
}

export function LiveTimingProvider({ 
  children,
  pollingInterval: pollingIntervalProp,
}: LiveTimingProviderProps) {
  const [state, setState] = useState<LiveTimingState>({
    drivers: [],
    weather: null,
    session: null,
    sessionState: null,
    liveTimingClock: null,
    trackStatus: null,
    raceMessages: [],
    radioCaptures: [],
    selectedDriverNumber: null,
    driverInfoMap: {},
    lapCount: null,
    positions: null,
    timingStats: null,
    driverTimingStats: [],
    topThree: null,
  })

  const setSelectedDriver = (racingNumber: string | null) => {
    setState(prev => ({ ...prev, selectedDriverNumber: racingNumber }))
  }

  useEffect(() => {
    let mounted = true
    let pollingInterval: ReturnType<typeof setInterval> | null = null
    let checkInterval: ReturnType<typeof setInterval> | null = null
    let currentPollingMs = pollingIntervalProp ?? POLLING_INTERVAL

    async function update() {
      const data = await fetchLiveTiming()
      if (!data || !mounted) return
      
      const drivers = parseDriverData(data)
      const radioCaptures = parseRadioCaptures(data)
      const leaderNumber = drivers[0]?.racingNumber || null
      const sessionState = parseSessionState(data)
      const isSessionActive = sessionState?.status === 'Started'

      // Determine interval based on session state
      const nextInterval = isSessionActive ? POLLING_INTERVAL : 60 * 1000 // 200ms if active, 1min if upcoming
      
      // Adjust interval if it changed
      if (nextInterval !== currentPollingMs && pollingInterval) {
        currentPollingMs = nextInterval
        clearInterval(pollingInterval)
        pollingInterval = setInterval(update, currentPollingMs)
      }

      setState(prev => ({
        ...prev,
        drivers,
        weather: parseWeatherData(data),
        session: parseSessionInfo(data),
        sessionState,
        liveTimingClock: parseLiveTimingClock(data),
        trackStatus: parseTrackStatus(data),
        raceMessages: parseRaceMessages(data),
        radioCaptures: radioCaptures,
        selectedDriverNumber: prev.selectedDriverNumber || leaderNumber,
        driverInfoMap: buildDriverInfoMap(data),
        lapCount: parseLapCount(data),
        positions: parsePositionData(data),
        timingStats: parseTimingStats(data),
        driverTimingStats: parseDriverTimingStats(data),
        topThree: parseTopThree(data),
      }))
    }

    async function checkPollingAndUpdate() {
      const shouldPoll = await shouldPollLiveTiming()
      
      if (!shouldPoll) {
        // No session within 1 hour window — stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval)
          pollingInterval = null
        }
        return
      }

      // Session within 1 hour — start or continue polling
      if (!pollingInterval) {
        // First time: do immediate update, then start interval
        await update()
        pollingInterval = setInterval(update, currentPollingMs)
      }
    }

    // Initial check
    checkPollingAndUpdate()

    // Check every 5 minutes if we should start/stop polling
    checkInterval = setInterval(checkPollingAndUpdate, 5 * 60 * 1000)

    return () => {
      mounted = false
      if (pollingInterval) clearInterval(pollingInterval)
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [])

  return (
    <LiveTimingContext.Provider value={{ ...state, setSelectedDriver }}>
      {children}
    </LiveTimingContext.Provider>
  )
}

export function useLiveTiming() {
  const context = useContext(LiveTimingContext)
  if (!context) {
    throw new Error("useLiveTiming must be used within LiveTimingProvider")
  }
  return context
}

export function useSelectDriver() {
  const context = useContext(LiveTimingContext)
  if (!context) {
    throw new Error("useSelectDriver must be used within LiveTimingProvider")
  }
  return context.setSelectedDriver
}

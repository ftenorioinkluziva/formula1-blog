"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { F1LiveTimingRawState, LiveTimingState } from "@/lib/live-timing/types"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
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
    function update(data: F1LiveTimingRawState) {
      
      const drivers = parseDriverData(data)
      const radioCaptures = parseRadioCaptures(data)
      const leaderNumber = drivers[0]?.racingNumber || null
      const sessionState = parseSessionState(data)
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

    return subscribeLiveTiming(update, pollingIntervalProp ?? POLLING_INTERVAL)
  }, [pollingIntervalProp])

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

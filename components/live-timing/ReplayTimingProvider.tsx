"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { LiveTimingState } from "@/lib/live-timing/types"
import type { F1LiveTimingRawState } from "@/lib/live-timing/types"
import type { PlaybackSpeed, ReplayControls, TimelineEvent } from "@/lib/live-timing/recording/types"
import { ReplayPlayer } from "@/lib/live-timing/recording/player"
import type { RecordingMessage } from "@/lib/live-timing/recording/types"

function parseRecordingMessages(content: string): RecordingMessage[] {
  const lines = content.split('\n').filter(Boolean)
  const messages: RecordingMessage[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.type === '__header__') continue
      if (parsed.type === '__snapshot__') {
        messages.push({ ts: parsed.ts, topic: '__snapshot__', data: parsed.state })
        continue
      }
      messages.push({ ts: parsed.ts, topic: parsed.topic, data: parsed.data })
    } catch { continue }
  }
  return messages
}
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

import { LiveTimingContext } from "./LiveTimingProvider"

const ReplayControlsContext = createContext<ReplayControls | null>(null)

interface ReplayTimingProviderProps {
  children: ReactNode
  sessionKey: string
  locale: string
}

const EMPTY_STATE: LiveTimingState = {
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
}

function parseRawState(rawState: F1LiveTimingRawState): Omit<LiveTimingState, 'selectedDriverNumber'> {
  const drivers = parseDriverData(rawState)
  return {
    drivers,
    weather: parseWeatherData(rawState),
    session: parseSessionInfo(rawState),
    sessionState: parseSessionState(rawState),
    liveTimingClock: parseLiveTimingClock(rawState),
    trackStatus: parseTrackStatus(rawState),
    raceMessages: parseRaceMessages(rawState),
    radioCaptures: parseRadioCaptures(rawState),
    driverInfoMap: buildDriverInfoMap(rawState),
    lapCount: parseLapCount(rawState),
    positions: parsePositionData(rawState),
    timingStats: parseTimingStats(rawState),
    driverTimingStats: parseDriverTimingStats(rawState),
    topThree: parseTopThree(rawState),
  }
}

export function ReplayTimingProvider({ children, sessionKey, locale }: ReplayTimingProviderProps) {
  const playerRef = useRef<ReplayPlayer | null>(null)
  const [state, setState] = useState<LiveTimingState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [speed, setSpeedState] = useState<PlaybackSpeed>(1)
  const [isPaused, setIsPaused] = useState(true)
  const [currentTs, setCurrentTs] = useState(0)
  const [startTs, setStartTs] = useState(0)
  const [endTs, setEndTs] = useState(0)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    const player = new ReplayPlayer()
    playerRef.current = player

    player.setOnUpdate((rawState, ts) => {
      if (cancelled) return
      const parsed = parseRawState(rawState)
      setState(prev => ({
        ...parsed,
        selectedDriverNumber: prev.selectedDriverNumber || parsed.drivers[0]?.racingNumber || null,
      }))

      const playerState = player.getState()
      setCurrentTs(ts)
      setProgress(playerState.progress)
      setIsPaused(playerState.isPaused)
    })

    async function loadRecording() {
      try {
        const res = await fetch(`/${locale}/api/recording/${encodeURIComponent(sessionKey)}`)
        if (!res.ok) throw new Error('Recording not found')

        const content = await res.text()
        const messages = parseRecordingMessages(content)
        if (messages.length === 0) throw new Error('Empty recording')

        player.load(messages)

        const playerState = player.getState()
        setStartTs(playerState.startTs)
        setEndTs(playerState.endTs)
        setEvents(playerState.events)
        setCurrentTs(playerState.currentTs)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load recording')
          setLoading(false)
        }
      }
    }

    loadRecording()

    return () => {
      cancelled = true
      player.destroy()
      playerRef.current = null
    }
  }, [sessionKey, locale])

  const setSelectedDriver = useCallback((racingNumber: string | null) => {
    setState(prev => ({ ...prev, selectedDriverNumber: racingNumber }))
  }, [])

  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedState(s)
    playerRef.current?.setSpeed(s)
  }, [])

  const togglePause = useCallback(() => {
    playerRef.current?.togglePause()
    const ps = playerRef.current?.getState()
    if (ps) setIsPaused(ps.isPaused)
  }, [])

  const seek = useCallback((ts: number) => {
    playerRef.current?.seekTo(ts)
  }, [])

  const controls: ReplayControls = useMemo(() => ({
    speed, setSpeed, isPaused, togglePause, seek,
    currentTs, startTs, endTs, events, progress,
  }), [speed, setSpeed, isPaused, togglePause, seek, currentTs, startTs, endTs, events, progress])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive">
        {error}
      </div>
    )
  }

  return (
    <LiveTimingContext.Provider value={{ ...state, setSelectedDriver }}>
      <ReplayControlsContext.Provider value={controls}>
        {children}
      </ReplayControlsContext.Provider>
    </LiveTimingContext.Provider>
  )
}

export function useReplayControls() {
  const context = useContext(ReplayControlsContext)
  if (!context) {
    throw new Error("useReplayControls must be used within ReplayTimingProvider")
  }
  return context
}

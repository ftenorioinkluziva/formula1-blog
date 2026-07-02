"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { ChevronDown, Cloud, Disc, GripHorizontal, GripVertical, Loader2, RotateCcw, Search, Tv2, Zap } from "lucide-react"
import { F1TVPlayer } from "@/components/live/f1tv-player"
import type { CameraChannel } from "@/components/live/multi-cam-selector"
import type { StreamInfo } from "@/components/watch/stream-picker"
import type { LapRow, IntervalRow, PitStopRow, ResultRow, SessionInfo, TireStintRow, WeatherRow } from "@/components/watch/sync-panel"

interface AvailableSession {
  sessionId: number
  sessionType: string
  sessionCode: string
  startTimeUtc: string
  grandPrixName: string
  season: number
  round: number
  country: string
  lapCount: number
}

interface SessionData {
  session: SessionInfo
  laps: LapRow[]
  intervals: IntervalRow[]
  results: ResultRow[]
  tireStints: TireStintRow[]
  pitStops: PitStopRow[]
  weather: WeatherRow[]
}

interface F1tvSession {
  contentId: number
  title: string
  contentSubtype: string
  duration: number
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#d1d5db",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
}

function matchF1tvSession(sessionCode: string, sessions: F1tvSession[]): F1tvSession | null {
  const keywords: Record<string, string[]> = {
    R: ["race"],
    Q: ["qualifying"],
    SQ: ["sprint qualifying", "sprint shootout"],
    S: ["sprint race", "sprint"],
    FP1: ["practice 1", "free practice 1"],
    FP2: ["practice 2", "free practice 2"],
    FP3: ["practice 3", "free practice 3"],
  }
  const terms = keywords[sessionCode] ?? []
  for (const term of terms) {
    const match = sessions.find((s) => s.title.toLowerCase().includes(term))
    if (match) return match
  }
  return sessions[0] ?? null
}

function formatGap(gap: number | null): string {
  if (gap === null) return "—"
  if (gap === 0) return "Líder"
  return `+${gap.toFixed(3)}`
}

interface SyncPoint {
  lapNumber: number
  driverCode: string
  videoSec: number
  lapRelSec: number
}

const EMPTY_DRIVER_LAPS: LapRow[] = []

function interpolateOffset(videoSec: number, points: SyncPoint[]): number {
  if (points.length === 0) return 0
  const sorted = [...points].sort((a, b) => a.videoSec - b.videoSec)
  if (videoSec <= sorted[0].videoSec) return sorted[0].videoSec - sorted[0].lapRelSec
  const last = sorted[sorted.length - 1]
  if (videoSec >= last.videoSec) return last.videoSec - last.lapRelSec
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i], p2 = sorted[i + 1]
    if (videoSec >= p1.videoSec && videoSec <= p2.videoSec) {
      const t = (videoSec - p1.videoSec) / (p2.videoSec - p1.videoSec)
      return (p1.videoSec - p1.lapRelSec) * (1 - t) + (p2.videoSec - p2.lapRelSec) * t
    }
  }
  return 0
}

export function WatchPageClient() {
  const locale = useLocale()

  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [sessionDataLoading, setSessionDataLoading] = useState(false)
  const [selectedDriverCode, setSelectedDriverCode] = useState<string | null>(null)

  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [videoTime, setVideoTime] = useState(0)
  const videoTimeRef = useRef(0)
  const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([])
  const [globalOffsetSeconds, setGlobalOffsetSeconds] = useState(0)

  const [obcChannels, setObcChannels] = useState<CameraChannel[]>([])
  const [activeContentId, setActiveContentId] = useState<number | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [f1tvSessionStartDate, setF1tvSessionStartDate] = useState<string | null>(null)
  const [trackerStream, setTrackerStream] = useState<StreamInfo | null>(null)
  const [dataStream, setDataStream] = useState<StreamInfo | null>(null)
  const [f1tvSearching, setF1tvSearching] = useState(false)
  const [f1tvError, setF1tvError] = useState<string | null>(null)
  const [meetingTitle, setMeetingTitle] = useState("")
  const [f1tvSessionOptions, setF1tvSessionOptions] = useState<F1tvSession[]>([])

  const [panelWidth, setPanelWidth] = useState(380)
  const [mainPlayerHeightPct, setMainPlayerHeightPct] = useState(60)
  const [miniSync, setMiniSync] = useState<{ seconds: number; key: number }>({ seconds: 0, key: 0 })
  const videoColumnRef = useRef<HTMLDivElement>(null)
  const [showF1tvSection, setShowF1tvSection] = useState(true)
  const [showSyncSection, setShowSyncSection] = useState(false)
  const [showWeatherSection, setShowWeatherSection] = useState(true)
  const [showTyreSection, setShowTyreSection] = useState(true)
  const [syncSavedToDb, setSyncSavedToDb] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const isRowDraggingRef = useRef(false)
  const currentLapRowRef = useRef<HTMLTableRowElement>(null)
  const lapListRef = useRef<HTMLDivElement>(null)

  const effectiveOffset = useMemo(
    () => interpolateOffset(videoTime, syncPoints) + globalOffsetSeconds,
    [videoTime, syncPoints, globalOffsetSeconds],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetch(`/${locale}/api/watch/sessions`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          const sessions: AvailableSession[] = data.sessions ?? []
          setAvailableSessions(sessions)
          if (sessions.length > 0) setSelectedSessionId(sessions[0].sessionId)
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSessionsLoading(false) })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [locale])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!selectedSessionId) {
        setSessionData(null)
        return
      }
      setSessionDataLoading(true)
      setSelectedDriverCode(null)
      setStream(null)
      setObcChannels([])
      setActiveContentId(null)
      setActiveChannelId(null)
      setF1tvSessionStartDate(null)
      setTrackerStream(null)
      setDataStream(null)
      setF1tvSessionOptions([])
      setMeetingTitle("")
      setF1tvError(null)
      setSyncPoints([])
      setGlobalOffsetSeconds(0)
      setSyncSavedToDb(false)
      fetch(`/${locale}/api/watch/laps?sessionId=${selectedSessionId}`)
        .then((r) => r.json())
        .then((data: SessionData) => {
          if (cancelled) return
          setSessionData(data)
          const drivers = [...new Map(
            data.laps.map((l) => [l.driverCode, l])
          ).values()].sort((a, b) => a.driverCode.localeCompare(b.driverCode))
          if (drivers.length > 0) setSelectedDriverCode(drivers[0].driverCode)
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSessionDataLoading(false) })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [selectedSessionId, locale])

  const loadObcStream = useCallback(
    async (contentId: number, channel: CameraChannel) => {
      setActiveChannelId(channel.channelId)
      setStream(null)
      const params = new URLSearchParams({
        contentId: String(contentId),
        channelId: String(channel.channelId),
      })
      const res = await fetch(`/${locale}/api/f1tv/streams?${params}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.url) {
        setStream({ url: data.url, streamType: data.streamType, laURL: data.laURL ?? null, drmToken: data.drmToken ?? null, channelId: channel.channelId })
      }
    },
    [locale],
  )

  const loadF1tvContent = useCallback(
    async (contentId: number) => {
      const res = await fetch(`/${locale}/api/f1tv/content?contentId=${contentId}`)
      if (!res.ok) return
      const detail = await res.json()
      const channels = (detail.channels ?? []) as CameraChannel[]
      const obc = channels.filter((c) => c.identifier === "OBC")
      const tracker = channels.find((c) => c.identifier === "TRACKER") ?? null
      const dataCh = channels.find((c) => c.identifier === "DATA") ?? null
      setObcChannels(obc)
      setActiveContentId(contentId)
      if (detail.sessionStartDate) {
        setF1tvSessionStartDate(detail.sessionStartDate)
      }
      if (tracker) {
        fetch(`/${locale}/api/f1tv/streams?contentId=${contentId}&channelId=${tracker.channelId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.url) setTrackerStream({ url: d.url, streamType: d.streamType, laURL: d.laURL ?? null, drmToken: d.drmToken ?? null, channelId: tracker.channelId })
          })
          .catch(() => {})
      }
      if (dataCh) {
        fetch(`/${locale}/api/f1tv/streams?contentId=${contentId}&channelId=${dataCh.channelId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.url) setDataStream({ url: d.url, streamType: d.streamType, laURL: d.laURL ?? null, drmToken: d.drmToken ?? null, channelId: dataCh.channelId })
          })
          .catch(() => {})
      }
    },
    [locale],
  )

  const searchF1tv = useCallback(async () => {
    if (!sessionData) return
    setF1tvSearching(true)
    setF1tvError(null)
    setF1tvSessionOptions([])
    try {
      const { season, grandPrixName } = sessionData.session
      const res = await fetch(`/${locale}/api/f1tv/content?season=${season}&q=${encodeURIComponent(grandPrixName)}`)
      if (res.status === 401) { setF1tvError("F1TV não autenticado"); return }
      if (!res.ok) throw new Error()
      const meetings = await res.json()
      const meeting = Array.isArray(meetings) ? meetings[0] : null
      if (!meeting?.detailUri) { setF1tvError("Nenhum conteúdo encontrado"); return }
      setMeetingTitle(meeting.meeting ?? meeting.title ?? "")
      const sessRes = await fetch(`/${locale}/api/f1tv/content?meetingUri=${encodeURIComponent(meeting.detailUri)}&season=${season}`)
      if (!sessRes.ok) throw new Error()
      const sessions: F1tvSession[] = await sessRes.json()
      const replays = sessions.filter((s) => s.contentSubtype === "REPLAY")
      const options = replays.length > 0 ? replays : sessions
      setF1tvSessionOptions(options)
      const autoMatch = matchF1tvSession(sessionData.session.sessionCode, options)
      if (autoMatch) await loadF1tvContent(autoMatch.contentId)
    } catch {
      setF1tvError("Erro ao buscar conteúdo F1TV")
    } finally {
      setF1tvSearching(false)
    }
  }, [sessionData, locale, loadF1tvContent])

  useEffect(() => {
    if (!f1tvSessionStartDate || !sessionData) return
    const timer = window.setTimeout(() => {
      const f1tvMs = new Date(f1tvSessionStartDate).getTime()
      const dbMs = new Date(sessionData.session.startTimeUtc).getTime()
      if (!Number.isFinite(f1tvMs) || !Number.isFinite(dbMs)) return
      const autoOffset = Math.round((dbMs - f1tvMs) / 1000)
      setGlobalOffsetSeconds(autoOffset)
      setSyncPoints([])
    }, 0)

    return () => window.clearTimeout(timer)
  }, [f1tvSessionStartDate, sessionData])

  useEffect(() => {
    if (!selectedDriverCode || obcChannels.length === 0 || !activeContentId) return
    const timer = window.setTimeout(() => {
      const driverLap = sessionData?.laps.find((l) => l.driverCode === selectedDriverCode)
      if (!driverLap) return
      const obc = obcChannels.find((c) => c.racingNumber === driverLap.driverNumber)
      if (obc && obc.channelId !== activeChannelId) {
        loadObcStream(activeContentId, obc)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [selectedDriverCode, obcChannels, activeContentId, sessionData, activeChannelId, loadObcStream])

  useEffect(() => {
    if (!selectedSessionId || !activeContentId || f1tvSessionStartDate) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      async function tryLoadSync() {
        const channelsToTry = activeChannelId !== null ? [activeChannelId, null] : [null]
        for (const ch of channelsToTry) {
          const chParam = ch !== null ? `&channelId=${ch}` : ""
          try {
            const res = await fetch(`/${locale}/api/watch/sync?sessionId=${selectedSessionId}&contentId=${activeContentId}${chParam}`)
            if (!res.ok) continue
            const data = await res.json()
            if (cancelled) return
            if (data.sync?.streamStartUtc) {
              setF1tvSessionStartDate(data.sync.streamStartUtc)
              setSyncPoints([])
              setSyncSavedToDb(true)
              return
            }
          } catch {}
        }
      }
      void tryLoadSync()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  // f1tvSessionStartDate intentionally excluded — checked as guard to avoid override
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, activeContentId, activeChannelId, locale])

  const handleSyncMiniPlayers = useCallback(() => {
    setMiniSync(prev => ({ seconds: videoTime, key: prev.key + 1 }))
  }, [videoTime])

  const handleRowDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isRowDraggingRef.current = true
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    const onMouseMove = (ev: MouseEvent) => {
      if (!isRowDraggingRef.current || !videoColumnRef.current) return
      const rect = videoColumnRef.current.getBoundingClientRect()
      const rawPct = ((ev.clientY - rect.top) / rect.height) * 100
      setMainPlayerHeightPct(Math.min(85, Math.max(25, rawPct)))
    }
    const onMouseUp = () => {
      isRowDraggingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setPanelWidth(Math.min(600, Math.max(240, rect.right - ev.clientX)))
    }
    const onMouseUp = () => {
      isDraggingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [])

  function markLightsOut() {
    if (!sessionData || driverLaps.length === 0) return
    const lap1 = driverLaps[0]
    const lap1UtcMs = new Date(lap1.openf1DateStart ?? lap1.occurredAtUtc).getTime()
    if (!isFinite(lap1UtcMs)) return
    const streamStartMs = lap1UtcMs - videoTimeRef.current * 1000
    const streamStartUtc = new Date(streamStartMs).toISOString()
    setF1tvSessionStartDate(streamStartUtc)
    setSyncPoints([])
    if (selectedSessionId && activeContentId) {
      fetch(`/${locale}/api/watch/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId, contentId: activeContentId, channelId: activeChannelId, streamStartUtc }),
      })
        .then((r) => { if (r.ok) setSyncSavedToDb(true) })
        .catch(() => {})
    }
  }

  const groupedSessions = useMemo(() => {
    const groups: Record<string, AvailableSession[]> = {}
    for (const s of availableSessions) {
      const key = `${s.season} — ${s.grandPrixName}`
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    }
    return groups
  }, [availableSessions])

  const driverList = useMemo(() => {
    if (!sessionData) return []
    const seen = new Set<string>()
    return sessionData.laps
      .filter((l) => { if (seen.has(l.driverCode)) return false; seen.add(l.driverCode); return true })
      .map((l) => ({ code: l.driverCode, fullName: l.fullName, teamColor: l.teamColor, driverNumber: l.driverNumber }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [sessionData])

  const driverInfo = useMemo(() => {
    if (!selectedDriverCode || !sessionData) return null
    const lap = sessionData.laps.find((l) => l.driverCode === selectedDriverCode)
    const result = sessionData.results.find((r) => r.driverCode === selectedDriverCode)
    if (!lap) return null
    return {
      fullName: lap.fullName,
      teamColor: lap.teamColor,
      driverNumber: lap.driverNumber,
      position: result?.position ?? null,
    }
  }, [selectedDriverCode, sessionData])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const driverLaps = useMemo(() => {
    if (!selectedDriverCode || !sessionData) return EMPTY_DRIVER_LAPS
    return [...sessionData.laps.filter((l) => l.driverCode === selectedDriverCode)].sort(
      (a, b) => a.lapNumber - b.lapNumber,
    )
  }, [sessionData, selectedDriverCode])

  const driverIntervalMap = useMemo(() => {
    if (!selectedDriverCode || !sessionData) return {} as Record<number, IntervalRow>
    return Object.fromEntries(
      sessionData.intervals
        .filter((i) => i.driverCode === selectedDriverCode)
        .map((i) => [i.lapNumber, i]),
    )
  }, [sessionData, selectedDriverCode])

  const driverTireStints = useMemo(() => {
    if (!selectedDriverCode || !sessionData?.tireStints) return []
    return sessionData.tireStints
      .filter((s) => s.driverCode === selectedDriverCode)
      .sort((a, b) => a.stintNumber - b.stintNumber)
  }, [sessionData, selectedDriverCode])

  const driverPitStops = useMemo(() => {
    if (!selectedDriverCode || !sessionData?.pitStops) return []
    return sessionData.pitStops
      .filter((s) => s.driverCode === selectedDriverCode)
      .sort((a, b) => a.lap - b.lap)
  }, [sessionData, selectedDriverCode])

  const currentLapIndex = (() => {
    if (!sessionData || driverLaps.length === 0) return -1

    if (f1tvSessionStartDate) {
      const f1tvStartMs = new Date(f1tvSessionStartDate).getTime()
      for (let i = driverLaps.length - 1; i >= 0; i--) {
        const lap = driverLaps[i]
        const dateStr = lap.openf1DateStart ?? lap.occurredAtUtc
        const lapVideoSec = (new Date(dateStr).getTime() - f1tvStartMs) / 1000
        if (videoTime >= lapVideoSec) return i
      }
      return -1
    }

    const sessionStartMs = new Date(sessionData.session.startTimeUtc).getTime()
    const wallClockMs = sessionStartMs + (videoTime - effectiveOffset) * 1000
    for (let i = driverLaps.length - 1; i >= 0; i--) {
      if (new Date(driverLaps[i].occurredAtUtc).getTime() <= wallClockMs) return i
    }
    return -1
  })()

  const visibleLapNum = (() => {
    if (!f1tvSessionStartDate || currentLapIndex < 0) return null
    const displayIdx = Math.max(0, currentLapIndex - 1)
    return driverLaps[displayIdx]?.lapNumber ?? null
  })()

  const currentTireStint = (() => {
    if (driverTireStints.length === 0 || currentLapIndex < 0) return null
    const displayIdx = f1tvSessionStartDate ? Math.max(0, currentLapIndex - 1) : currentLapIndex
    const currentLapNum = driverLaps[displayIdx]?.lapNumber ?? 0
    return (
      driverTireStints.find((s) => currentLapNum >= s.lapStart && currentLapNum <= s.lapEnd) ??
      driverTireStints[driverTireStints.length - 1]
    )
  })()

  const tyreAgeNow = (() => {
    if (!currentTireStint || currentLapIndex < 0) return null
    const displayIdx = f1tvSessionStartDate ? Math.max(0, currentLapIndex - 1) : currentLapIndex
    const currentLapNum = driverLaps[displayIdx]?.lapNumber ?? currentTireStint.lapStart
    return currentLapNum - currentTireStint.lapStart + currentTireStint.tyreAgeAtStart
  })()

  const currentWeather = useMemo(() => {
    const weather = sessionData?.weather
    if (!weather || weather.length === 0) return null
    if (!f1tvSessionStartDate) return weather[weather.length - 1]
    const f1tvStartMs = new Date(f1tvSessionStartDate).getTime()
    const videoMs = f1tvStartMs + videoTime * 1000
    let best = weather[0]
    let bestDiff = Math.abs(new Date(weather[0].recordedAtUtc).getTime() - videoMs)
    for (const w of weather) {
      const diff = Math.abs(new Date(w.recordedAtUtc).getTime() - videoMs)
      if (diff < bestDiff) { bestDiff = diff; best = w }
    }
    return best
  }, [sessionData, f1tvSessionStartDate, videoTime])

  const currentPosition = (() => {
    if (!selectedDriverCode || !sessionData) return null
    const displayIdx = f1tvSessionStartDate ? Math.max(0, currentLapIndex - 1) : currentLapIndex
    if (displayIdx < 0) return null
    const refLap = driverLaps[displayIdx]?.lapNumber ?? null
    if (refLap === null) return null

    const latestLapPerDriver = new Map<string, number>()
    for (const iv of sessionData.intervals) {
      if (iv.lapNumber > refLap + 2) continue
      const existing = latestLapPerDriver.get(iv.driverCode) ?? -1
      if (iv.lapNumber > existing) latestLapPerDriver.set(iv.driverCode, iv.lapNumber)
    }

    const gapMap = new Map<string, number | null>()
    for (const [code, lap] of latestLapPerDriver) {
      const iv = sessionData.intervals.find((i) => i.driverCode === code && i.lapNumber === lap)
      gapMap.set(code, iv?.gapToLeader ?? null)
    }

    if (gapMap.size === 0) {
      const result = sessionData.results.find((r) => r.driverCode === selectedDriverCode)
      return result?.position ?? null
    }

    const hasGaps = [...gapMap.values()].some((g) => g !== null)
    const sorted = [...gapMap.entries()].sort((a, b) => {
      if (!hasGaps) {
        const pa = sessionData.results.find((r) => r.driverCode === a[0])?.position ?? 99
        const pb = sessionData.results.find((r) => r.driverCode === b[0])?.position ?? 99
        return pa - pb
      }
      if (a[1] === null && b[1] === null) return 0
      if (a[1] === null) return 1
      if (b[1] === null) return -1
      return a[1] - b[1]
    })

    const idx = sorted.findIndex(([code]) => code === selectedDriverCode)
    return idx >= 0 ? idx + 1 : null
  })()

  useEffect(() => {
    if (!currentLapRowRef.current || !lapListRef.current) return
    const row = currentLapRowRef.current
    const container = lapListRef.current
    const { top, bottom } = row.getBoundingClientRect()
    const { top: cTop, bottom: cBottom } = container.getBoundingClientRect()
    if (top < cTop || bottom > cBottom) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [currentLapIndex])

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="shrink-0 border-b border-gray-800 px-4 py-2 flex items-center gap-2 min-w-0">
        <Tv2 className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-100 shrink-0">Engineer Board</span>
        <div className="mx-1 h-4 w-px bg-gray-700 shrink-0" />

        {sessionsLoading ? (
          <span className="text-xs text-gray-500">Carregando…</span>
        ) : (
          <select
            className="bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded border border-gray-700 focus:outline-none max-w-xs"
            value={selectedSessionId ?? ""}
            onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecione uma sessão</option>
            {Object.entries(groupedSessions).map(([group, sessions]) => (
              <optgroup key={group} label={group}>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.sessionCode} · {s.lapCount} voltas
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        {driverList.length > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-gray-700 shrink-0" />
            <select
              className="bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded border border-gray-700 focus:outline-none"
              value={selectedDriverCode ?? ""}
              onChange={(e) => setSelectedDriverCode(e.target.value || null)}
            >
              <option value="">Piloto</option>
              {driverList.map((d) => (
                <option key={d.code} value={d.code}>
                  #{d.driverNumber} {d.code} — {d.fullName}
                </option>
              ))}
            </select>
          </>
        )}

        {stream && <span className="ml-2 text-xs text-green-400 font-medium shrink-0">● OBC</span>}
        {sessionDataLoading && <Loader2 className="w-3 h-3 text-gray-500 animate-spin ml-1 shrink-0" />}
      </header>

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <div ref={videoColumnRef} className="flex-1 flex flex-col bg-black overflow-hidden min-w-0">
          <div style={{ height: (trackerStream || dataStream) ? `${mainPlayerHeightPct}%` : "100%", minHeight: 0, flexShrink: 0 }}>
            <F1TVPlayer
              streamUrl={stream?.url ?? null}
              streamType={stream?.streamType}
              laURL={stream?.laURL}
              drmToken={stream?.drmToken}
              locale={locale}
              autoPlay={false}
              className="w-full h-full"
              onTimeUpdate={(t) => { videoTimeRef.current = t; setVideoTime(t) }}
              alwaysShowControls
              syncOffsetSeconds={globalOffsetSeconds}
              onSyncOffsetChange={setGlobalOffsetSeconds}
            />
          </div>
          {(trackerStream || dataStream) && (
            <>
            <div
              onMouseDown={handleRowDividerMouseDown}
              className="shrink-0 h-7 cursor-row-resize bg-gray-900 border-y border-gray-700/60 flex items-center justify-center gap-2 select-none"
            >
              <GripHorizontal className="w-3 h-3 text-gray-600 pointer-events-none" />
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={handleSyncMiniPlayers}
                disabled={videoTime === 0}
                className="flex items-center gap-1 text-[10px] bg-gray-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 px-2 py-0.5 rounded transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Sync Players
              </button>
              <GripHorizontal className="w-3 h-3 text-gray-600 pointer-events-none" />
            </div>
            <div style={{ flex: "1 1 0", minHeight: 0 }} className="flex gap-px bg-gray-900">
              {trackerStream && (
                <div className="flex-1 relative min-w-0">
                  <span className="absolute top-1 left-1 z-10 text-[10px] bg-black/70 text-gray-300 px-1.5 py-0.5 rounded pointer-events-none">Tracker</span>
                  <F1TVPlayer
                    streamUrl={trackerStream.url}
                    streamType={trackerStream.streamType}
                    laURL={trackerStream.laURL}
                    drmToken={trackerStream.drmToken}
                    locale={locale}
                    autoPlay
                    resumeAtSeconds={miniSync.seconds}
                    forceSyncKey={miniSync.key}
                    className="w-full h-full"
                  />
                </div>
              )}
              {dataStream && (
                <div className="flex-1 relative min-w-0">
                  <span className="absolute top-1 left-1 z-10 text-[10px] bg-black/70 text-gray-300 px-1.5 py-0.5 rounded pointer-events-none">Data Channel</span>
                  <F1TVPlayer
                    streamUrl={dataStream.url}
                    streamType={dataStream.streamType}
                    laURL={dataStream.laURL}
                    drmToken={dataStream.drmToken}
                    locale={locale}
                    autoPlay
                    resumeAtSeconds={miniSync.seconds}
                    forceSyncKey={miniSync.key}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
            </>
          )}
        </div>

        <div
          onMouseDown={handleDividerMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-red-500/60 transition-colors flex items-center justify-center group"
        >
          <GripVertical className="w-3 h-3 text-gray-600 group-hover:text-red-400 pointer-events-none" />
        </div>

        <div className="shrink-0 flex flex-col overflow-y-auto border-l border-gray-800" style={{ width: panelWidth }}>
          <section className="border-b border-gray-800">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800/50"
              onClick={() => setShowF1tvSection((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Search className="w-3 h-3 text-red-400" />
                Onboard F1TV
                {meetingTitle && <span className="text-gray-500 font-normal">· {meetingTitle}</span>}
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showF1tvSection ? "" : "-rotate-90"}`} />
            </button>
            {showF1tvSection && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {!sessionData ? (
                  <p className="text-xs text-gray-500">Selecione uma sessão primeiro.</p>
                ) : (
                  <>
                    <button
                      onClick={searchF1tv}
                      disabled={f1tvSearching}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs text-gray-200 transition-colors"
                    >
                      {f1tvSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      {f1tvSearching ? "Buscando…" : `${sessionData.session.grandPrixName} ${sessionData.session.season}`}
                    </button>
                    {f1tvError && <p className="text-xs text-red-400">{f1tvError}</p>}
                    {f1tvSessionOptions.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {f1tvSessionOptions.map((s) => (
                          <button
                            key={s.contentId}
                            onClick={() => loadF1tvContent(s.contentId)}
                            className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              activeContentId === s.contentId
                                ? "bg-red-900/40 text-red-300 border border-red-800/50"
                                : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                            }`}
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {activeContentId && obcChannels.length === 0 && !f1tvSearching && (
                      <p className="text-xs text-yellow-500">Nenhuma câmera onboard disponível nesta sessão.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <section className="border-b border-gray-800">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800/50"
              onClick={() => setShowSyncSection((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-yellow-400" />
                Sincronismo
                {syncSavedToDb && (
                  <span className="text-green-500 font-normal">· salvo ✓</span>
                )}
                {f1tvSessionStartDate && syncPoints.length === 0 && !syncSavedToDb && (
                  <span className="text-green-400 font-normal">· auto</span>
                )}
                {syncPoints.length > 0 && (
                  <span className="text-gray-500 font-normal">· {syncPoints.length} pt{syncPoints.length !== 1 ? "s" : ""}</span>
                )}
                <span className={`font-mono text-[11px] ml-1 ${effectiveOffset !== 0 ? "text-yellow-400" : "text-gray-500"}`}>
                  {effectiveOffset >= 0 ? "+" : ""}{effectiveOffset.toFixed(1)}s
                </span>
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showSyncSection ? "" : "-rotate-90"}`} />
            </button>
            {showSyncSection && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {f1tvSessionStartDate
                    ? "Sincronizado pelo início do stream. Ajuste fino com os botões abaixo."
                    : "Pause o vídeo no início de uma volta e clique ⚡ na tabela para adicionar um ponto de sincronia. Múltiplos pontos interpolam automaticamente."}
                </p>
                {driverLaps.length > 0 && (
                  <button
                    onClick={markLightsOut}
                    disabled={videoTime === 0}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-yellow-900/40 hover:bg-yellow-800/50 border border-yellow-700/50 disabled:opacity-40 text-xs text-yellow-300 transition-colors w-full"
                    title="Pause o vídeo no momento da largada e clique aqui"
                  >
                    <Zap className="w-3 h-3" />
                    Marcar Largada (Volta 1)
                  </button>
                )}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    {([-30, -5, -1] as const).map((step) => (
                      <button
                        key={step}
                        onClick={() => setGlobalOffsetSeconds((v) => Math.round((v + step) * 10) / 10)}
                        className="flex-1 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-mono"
                      >
                        {step}s
                      </button>
                    ))}
                    <button
                      onClick={() => { setSyncPoints([]); setGlobalOffsetSeconds(0) }}
                      className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-500"
                      title="Limpar pontos e resetar"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    {([1, 5, 30] as const).map((step) => (
                      <button
                        key={step}
                        onClick={() => setGlobalOffsetSeconds((v) => Math.round((v + step) * 10) / 10)}
                        className="flex-1 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-mono"
                      >
                        +{step}s
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {([-0.5, -0.1] as const).map((step) => (
                      <button
                        key={step}
                        onClick={() => setGlobalOffsetSeconds((v) => Math.round((v + step) * 10) / 10)}
                        className="flex-1 py-1 rounded bg-gray-700/60 hover:bg-gray-600/60 text-[11px] text-blue-300 font-mono"
                      >
                        {step}s
                      </button>
                    ))}
                    <div className="flex-1" />
                    {([0.1, 0.5] as const).map((step) => (
                      <button
                        key={step}
                        onClick={() => setGlobalOffsetSeconds((v) => Math.round((v + step) * 10) / 10)}
                        className="flex-1 py-1 rounded bg-gray-700/60 hover:bg-gray-600/60 text-[11px] text-blue-300 font-mono"
                      >
                        +{step}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span>Vídeo:</span>
                  <span className="font-mono text-gray-300">
                    {Math.floor(videoTime / 60)}:{String(Math.floor(videoTime % 60)).padStart(2, "0")}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="border-b border-gray-800">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800/50"
              onClick={() => setShowWeatherSection((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Cloud className="w-3 h-3 text-blue-400" />
                Clima
                {currentWeather && (
                  <span className="text-gray-500 font-normal">
                    · {currentWeather.airTemperature?.toFixed(0)}° / {currentWeather.trackTemperature?.toFixed(0)}°
                    {currentWeather.rainfall ? " 🌧" : ""}
                  </span>
                )}
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showWeatherSection ? "" : "-rotate-90"}`} />
            </button>
            {showWeatherSection && currentWeather && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <div className="text-[10px] text-gray-500">Ar</div>
                  <div className="text-sm font-mono text-white">{currentWeather.airTemperature?.toFixed(1) ?? "—"}°C</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Pista</div>
                  <div className="text-sm font-mono text-orange-300">{currentWeather.trackTemperature?.toFixed(1) ?? "—"}°C</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Humidade</div>
                  <div className="text-sm font-mono text-blue-300">{currentWeather.humidity != null ? `${currentWeather.humidity}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Vento</div>
                  <div className="text-sm font-mono text-gray-200">{currentWeather.windSpeed != null ? `${currentWeather.windSpeed.toFixed(0)} km/h` : "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-gray-500">Condição</div>
                  <div className={`text-xs font-medium ${currentWeather.rainfall ? "text-blue-400" : "text-green-400"}`}>
                    {currentWeather.rainfall ? "🌧 Chuva" : "☀ Seco"}
                  </div>
                </div>
              </div>
            )}
            {showWeatherSection && !currentWeather && (
              <p className="px-3 pb-3 text-xs text-gray-500">Sem dados de clima.</p>
            )}
          </section>

          <section className="border-b border-gray-800">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800/50"
              onClick={() => setShowTyreSection((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Disc className="w-3 h-3 text-orange-400" />
                Pneus
                {currentTireStint && (
                  <span className="flex items-center gap-1 ml-0.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COMPOUND_COLORS[currentTireStint.compound.toUpperCase()] ?? "#666" }}
                    />
                    <span className="text-gray-500 font-normal">
                      {tyreAgeNow != null ? `${tyreAgeNow} voltas` : currentTireStint.compound}
                    </span>
                  </span>
                )}
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showTyreSection ? "" : "-rotate-90"}`} />
            </button>
            {showTyreSection && selectedDriverCode && (
              <div className="px-3 pb-3 flex flex-col gap-3">
                {currentTireStint && (visibleLapNum !== null || !f1tvSessionStartDate) ? (
                  <div className="flex items-center gap-3 bg-gray-800/50 rounded px-2.5 py-2">
                    <span
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: COMPOUND_COLORS[currentTireStint.compound.toUpperCase()] ?? "#666" }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">{currentTireStint.compound}</div>
                      <div className="text-[11px] text-gray-400">
                        V{currentTireStint.lapStart}–{currentTireStint.lapEnd}
                        {tyreAgeNow != null && ` · ${tyreAgeNow} vol. de uso`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Sem stint ativo.</p>
                )}
                {driverTireStints.filter((s) => visibleLapNum === null || s.lapStart <= visibleLapNum).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Stints</div>
                    {driverTireStints.filter((s) => visibleLapNum === null || s.lapStart <= visibleLapNum).map((stint) => (
                      <div key={stint.stintNumber} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COMPOUND_COLORS[stint.compound.toUpperCase()] ?? "#666" }}
                        />
                        <span className="text-[11px] text-gray-300 font-mono">V{stint.lapStart}–{stint.lapEnd}</span>
                        <span className="text-[11px] text-gray-500">({stint.lapEnd - stint.lapStart + 1} vol.)</span>
                        {stint.tyreAgeAtStart > 0 && (
                          <span className="text-[10px] text-yellow-500 ml-auto">+{stint.tyreAgeAtStart} usado</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {driverPitStops.filter((s) => visibleLapNum === null || s.lap <= visibleLapNum).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Pitstops</div>
                    {driverPitStops.filter((s) => visibleLapNum === null || s.lap <= visibleLapNum).map((stop) => (
                      <div key={stop.stopNumber} className="flex items-center gap-2 text-[11px]">
                        <span className="text-gray-500 font-mono w-4">#{stop.stopNumber}</span>
                        <span className="text-gray-300">V{stop.lap}</span>
                        {stop.duration && (
                          <span className="ml-auto font-mono text-green-400">{stop.duration}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {driverTireStints.length === 0 && driverPitStops.length === 0 && (
                  <p className="text-xs text-gray-500">Sem dados de pneus/pitstops.</p>
                )}
              </div>
            )}
            {showTyreSection && !selectedDriverCode && (
              <p className="px-3 pb-3 text-xs text-gray-500">Selecione um piloto.</p>
            )}
          </section>

          <section className="flex-1 flex flex-col overflow-hidden">
            {!selectedDriverCode ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-xs text-gray-500 text-center">
                  {selectedSessionId ? "Selecione um piloto no topo." : "Selecione uma sessão para começar."}
                </p>
              </div>
            ) : (
              <>
                {driverInfo && (
                  <div className="px-3 py-3 border-b border-gray-800 flex items-center gap-3 shrink-0">
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: driverInfo.teamColor || "#666" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{driverInfo.fullName}</div>
                      <div className="text-xs text-gray-400">#{driverInfo.driverNumber}</div>
                    </div>
                    {(currentPosition ?? driverInfo.position) && (
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-gray-500">Posição</div>
                        <div className="text-xl font-bold text-white">P{currentPosition ?? driverInfo.position}</div>
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const displayIdx = f1tvSessionStartDate
                    ? currentLapIndex - 1
                    : currentLapIndex
                  if (displayIdx < 0 || !driverLaps[displayIdx]) return null
                  const cl = driverLaps[displayIdx]
                  const clInterval = driverIntervalMap[cl?.lapNumber]
                  return (
                    <div className="px-3 py-2 border-b border-gray-800 bg-yellow-900/10 shrink-0">
                      <div className="flex items-center gap-4 mb-1.5">
                        <div>
                          <div className="text-[10px] text-gray-500">Volta</div>
                          <div className="text-base font-bold text-yellow-400">{cl?.lapNumber}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500">Tempo</div>
                          <div className="text-sm font-mono text-white">{cl?.lapTime ?? "—"}</div>
                        </div>
                        {cl?.compound && (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COMPOUND_COLORS[cl.compound.toUpperCase()] ?? "#666" }}
                            />
                            <span className="text-[11px] text-gray-400">{cl.compound}</span>
                          </div>
                        )}
                        {clInterval?.gapToLeader && (
                          <div className="ml-auto text-right shrink-0">
                            <div className="text-[10px] text-gray-500">Gap</div>
                            <div className="text-xs font-mono text-red-400">{formatGap(clInterval.gapToLeader)}</div>
                          </div>
                        )}
                        {clInterval?.intervalToAhead && (
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-gray-500">Int</div>
                            <div className="text-xs font-mono text-orange-300">{formatGap(clInterval.intervalToAhead)}</div>
                          </div>
                        )}
                      </div>
                      {(cl?.sector1 || cl?.sector2 || cl?.sector3 || cl?.stSpeed) && (
                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          {cl?.sector1 && <span className="text-gray-300"><span className="text-gray-500 mr-0.5">S1</span>{cl.sector1}</span>}
                          {cl?.sector2 && <span className="text-gray-300"><span className="text-gray-500 mr-0.5">S2</span>{cl.sector2}</span>}
                          {cl?.sector3 && <span className="text-gray-300"><span className="text-gray-500 mr-0.5">S3</span>{cl.sector3}</span>}
                          {cl?.stSpeed && <span className="ml-auto text-blue-300">{cl.stSpeed} km/h</span>}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="flex-1 overflow-y-auto" ref={lapListRef}>
                  {driverLaps.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Sem dados de voltas.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-900 z-10">
                        <tr className="text-[11px] text-gray-500 border-b border-gray-800">
                          <th className="px-2 py-1.5 text-left w-8">#</th>
                          <th className="px-2 py-1.5 text-left">Tempo</th>
                          <th className="px-1 py-1.5 text-right">S1</th>
                          <th className="px-1 py-1.5 text-right">S2</th>
                          <th className="px-1 py-1.5 text-right">S3</th>
                          <th className="px-1 py-1.5 text-right">km/h</th>
                          <th className="px-1 py-1.5 text-right">Gap</th>
                          <th className="px-1 py-1.5 text-right">Int</th>
                          <th className="px-2 py-1.5 text-center w-5">T</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverLaps
                          .filter((_, index) => !f1tvSessionStartDate || (currentLapIndex >= 0 && index < currentLapIndex))
                          .map((lap) => {
                          const absoluteIdx = driverLaps.indexOf(lap)
                          const isCurrent = absoluteIdx === currentLapIndex - 1
                          const interval = driverIntervalMap[lap.lapNumber]
                          const compound = lap.compound?.toUpperCase()
                          return (
                            <tr
                              key={lap.lapNumber}
                              ref={isCurrent ? currentLapRowRef : undefined}
                              className={`border-b border-gray-800/40 ${isCurrent ? "bg-yellow-900/20" : "hover:bg-gray-800/30"}`}
                            >
                              <td className={`px-2 py-1 tabular-nums ${isCurrent ? "text-yellow-400 font-bold" : "text-gray-500"}`}>
                                {lap.lapNumber}
                              </td>
                              <td className={`px-2 py-1 font-mono tabular-nums text-[11px] ${lap.pitIn || lap.pitOut ? "text-blue-400" : "text-gray-200"}`}>
                                {lap.lapTime ?? "—"}
                                {lap.pitIn && <span className="ml-1 text-[9px] text-blue-400">PIT</span>}
                              </td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-gray-400 text-right">{lap.sector1 ?? ""}</td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-gray-400 text-right">{lap.sector2 ?? ""}</td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-gray-400 text-right">{lap.sector3 ?? ""}</td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-blue-300/70 text-right">{lap.stSpeed ?? ""}</td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-gray-400 text-right">
                                {formatGap(interval?.gapToLeader ?? null)}
                              </td>
                              <td className="px-1 py-1 font-mono tabular-nums text-[10px] text-orange-300/80 text-right">
                                {formatGap(interval?.intervalToAhead ?? null)}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {compound && (
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: COMPOUND_COLORS[compound] ?? "#666" }}
                                    title={compound}
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

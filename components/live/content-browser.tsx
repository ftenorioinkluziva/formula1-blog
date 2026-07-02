"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLocale } from "next-intl"
import { Search, Play, Loader2, MapPin, Clock, ChevronRight, Film, Trophy, BarChart3 } from "lucide-react"
import { F1TVPlayer } from "./f1tv-player"
import { MultiCamSelector, type CameraChannel } from "./multi-cam-selector"
import type { F1TVPlaybackStream as StreamInfo } from "@/lib/f1tv/playback"

interface Meeting {
  contentId: number
  title: string
  season: number
  meeting: string
  circuit: string
  pictureUrl: string | null
  detailUri: string | null
}

interface Session {
  contentId: number
  title: string
  duration: number
  contentSubtype: string
  pictureUrl: string | null
  isOnAir: boolean
}

interface ContentDetail {
  contentId: number
  title: string
  meeting: string
  channels: CameraChannel[]
}


function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const SUBTYPE_ICONS: Record<string, typeof Film> = {
  REPLAY: Play,
  HIGHLIGHTS: Film,
  ANALYSIS: BarChart3,
}

const SUBTYPE_LABELS: Record<string, string> = {
  REPLAY: "Full Replay",
  HIGHLIGHTS: "Highlights",
  ANALYSIS: "Analysis",
}

const CURRENT_YEAR = new Date().getFullYear()

interface ContentBrowserProps {
  initialMeetingUri?: string | null
}

export function ContentBrowser({ initialMeetingUri }: ContentBrowserProps = {}) {
  const locale = useLocale()

  const [query, setQuery] = useState("")
  const [season, setSeason] = useState(String(CURRENT_YEAR))
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [selectedSession, setSelectedSession] = useState<ContentDetail | null>(null)
  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [activeChannel, setActiveChannel] = useState<CameraChannel | null>(null)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialHandledRef = useRef(false)

  const loadMeetings = useCallback(async (searchQuery?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ season })
      const q = searchQuery ?? query
      if (q) params.set("q", q)

      const res = await fetch(`/${locale}/api/f1tv/content?${params}`)
      if (!res.ok) {
        if (res.status === 401) {
          setError("F1TV not authenticated — run pnpm f1tv:login")
          return
        }
        throw new Error("Failed to load content")
      }

      const data = await res.json()
      setMeetings(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content")
    } finally {
      setLoading(false)
    }
  }, [query, season, locale])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMeetings("")
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadMeetings])

  const openMeeting = useCallback(async (meeting: Meeting) => {
    if (!meeting.detailUri) return
    setSelectedMeeting(meeting)
    setSessions([])
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ meetingUri: meeting.detailUri, season })
      const res = await fetch(`/${locale}/api/f1tv/content?${params}`)
      if (!res.ok) throw new Error("Failed to load sessions")

      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }, [locale, season])

  useEffect(() => {
    if (initialHandledRef.current || !initialMeetingUri) return
    initialHandledRef.current = true

    const fakeMeeting: Meeting = {
      contentId: 0,
      title: "",
      season: Number(season),
      meeting: "Loading...",
      circuit: "",
      pictureUrl: null,
      detailUri: initialMeetingUri,
    }
    void openMeeting(fakeMeeting)
  }, [initialMeetingUri, openMeeting, season])

  async function openSession(session: Session) {
    setLoading(true)
    setError(null)
    setStream(null)
    setActiveChannel(null)
    setPlaybackPosition(0)

    try {
      const res = await fetch(`/${locale}/api/f1tv/content?contentId=${session.contentId}`)
      if (!res.ok) throw new Error("Failed to load content details")

      const detail: ContentDetail = await res.json()
      setSelectedSession(detail)

      const wif = detail.channels.find((c) => c.identifier === "WIF")
      const firstChannel = wif ?? detail.channels[0]

      if (firstChannel) {
        setActiveChannel(firstChannel)
        await loadStream(session.contentId, firstChannel.channelId)
      } else {
        await loadStream(session.contentId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session")
    } finally {
      setLoading(false)
    }
  }

  async function loadStream(contentId: number, channelId?: number) {
    try {
      const params = new URLSearchParams({ contentId: contentId.toString() })
      if (channelId) params.set("channelId", channelId.toString())

      const res = await fetch(`/${locale}/api/f1tv/streams?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Stream unavailable")
      }

      const data = await res.json()
      if (data.url) {
        setStream({ url: data.url, streamType: data.streamType, laURL: data.laURL ?? null, drmToken: data.drmToken ?? null, channelId: data.channelId ?? channelId ?? 0 })
      } else {
        setError("No playable stream found")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream error")
    }
  }

  async function handleChannelSelect(channel: CameraChannel) {
    setActiveChannel(channel)
    if (selectedSession) {
      setStream(null)
      await loadStream(selectedSession.contentId, channel.channelId)
    }
  }

  function goBackToMeetings() {
    setSelectedMeeting(null)
    setSelectedSession(null)
    setSessions([])
    setStream(null)
    setActiveChannel(null)
    setPlaybackPosition(0)
    setError(null)
  }

  function goBackToSessions() {
    setSelectedSession(null)
    setStream(null)
    setActiveChannel(null)
    setPlaybackPosition(0)
    setError(null)
  }

  if (selectedSession) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={goBackToSessions} className="text-zinc-400 hover:text-white text-sm">
            ← Back
          </button>
          <h2 className="text-white text-sm font-medium">
            {selectedMeeting?.meeting} — {selectedSession.title}
          </h2>
        </div>

        {selectedSession.channels.length > 0 && (
          <MultiCamSelector
            channels={selectedSession.channels}
            activeChannelId={activeChannel?.channelId ?? null}
            onChannelSelect={handleChannelSelect}
          />
        )}

        <F1TVPlayer
          streamUrl={stream?.url ?? null}
          streamType={stream?.streamType}
          laURL={stream?.laURL}
          drmToken={stream?.drmToken}
          locale={locale}
          resumeAtSeconds={playbackPosition}
          onTimeUpdate={setPlaybackPosition}
          className="aspect-video max-h-[70vh]"
        />
      </div>
    )
  }

  if (selectedMeeting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={goBackToMeetings} className="text-zinc-400 hover:text-white text-sm">
            ← Back
          </button>
          <h2 className="text-white text-sm font-medium">
            {selectedMeeting.meeting}
          </h2>
          <span className="text-zinc-500 text-xs">{selectedMeeting.circuit}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        )}

        <div className="space-y-1.5">
          {sessions.map((session) => {
            const Icon = SUBTYPE_ICONS[session.contentSubtype] ?? Film
            const label = SUBTYPE_LABELS[session.contentSubtype] ?? session.contentSubtype

            return (
              <button
                key={session.contentId}
                onClick={() => openSession(session)}
                className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 rounded-lg px-4 py-3 text-left transition-colors border border-zinc-800 hover:border-zinc-600"
              >
                <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="text-white text-sm font-medium flex-1 truncate">
                  {session.title}
                </span>
                <span className="text-zinc-500 text-xs shrink-0 px-2 py-0.5 rounded bg-zinc-800">
                  {label}
                </span>
                {session.duration > 0 && (
                  <span className="text-zinc-500 text-xs shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(session.duration)}
                  </span>
                )}
                {session.isOnAir && (
                  <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                    LIVE
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
              </button>
            )
          })}
        </div>

        {!loading && sessions.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">No sessions available</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-700"
        >
          {[2026, 2025, 2024, 2023].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadMeetings()}
            placeholder="Filter by name, circuit..."
            className="w-full bg-zinc-800 text-white text-sm rounded pl-10 pr-4 py-2 border border-zinc-700 placeholder:text-zinc-500"
          />
        </div>

        <button
          onClick={() => loadMeetings()}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading && meetings.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {meetings.map((meeting) => (
          <button
            key={meeting.contentId}
            onClick={() => openMeeting(meeting)}
            className="bg-zinc-900 hover:bg-zinc-800 rounded-lg overflow-hidden text-left transition-colors border border-zinc-800 hover:border-zinc-600"
          >
            <div className="aspect-video bg-zinc-800 relative">
              {meeting.pictureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://f1tv.formula1.com/image-resizer/image/${meeting.pictureUrl}?w=640&h=360&q=HI&o=L`}
                  alt={meeting.title}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                <Trophy className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="p-3 space-y-1">
              <h3 className="text-white text-sm font-medium truncate">{meeting.meeting}</h3>
              <div className="flex items-center gap-3 text-zinc-500 text-xs">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {meeting.circuit}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

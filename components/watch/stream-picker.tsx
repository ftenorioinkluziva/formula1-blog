"use client"

import { useState, useEffect, useCallback } from "react"
import { useLocale } from "next-intl"
import { ChevronRight, Film, Loader2, Play, Search, BarChart3, Tv } from "lucide-react"
import type { CameraChannel } from "@/components/live/multi-cam-selector"
import type { F1TVPlaybackStream } from "@/lib/f1tv/playback"

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

export type StreamInfo = F1TVPlaybackStream

interface StreamPickerProps {
  onStreamReady: (info: StreamInfo, contentId: number, title: string, channels: CameraChannel[]) => void
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

const CURRENT_YEAR = new Date().getFullYear()

export function StreamPicker({ onStreamReady }: StreamPickerProps) {
  const locale = useLocale()

  const [season, setSeason] = useState(String(CURRENT_YEAR))
  const [query, setQuery] = useState("")
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [loadingStreams, setLoadingStreams] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMeetings = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ season })
        if (q) params.set("q", q)
        const res = await fetch(`/${locale}/api/f1tv/content?${params}`)
        if (!res.ok) {
          if (res.status === 401) {
            setError("F1TV não autenticado — execute pnpm f1tv:login")
            return
          }
          throw new Error("Falha ao carregar conteúdo")
        }
        const data = await res.json()
        setMeetings(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar conteúdo")
      } finally {
        setLoading(false)
      }
    },
    [season, locale],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMeetings("")
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadMeetings, season, locale])

  async function openMeeting(meeting: Meeting) {
    if (!meeting.detailUri) return
    setSelectedMeeting(meeting)
    setSessions([])
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ meetingUri: meeting.detailUri, season })
      const res = await fetch(`/${locale}/api/f1tv/content?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar sessões")
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar sessões")
    } finally {
      setLoading(false)
    }
  }

  async function selectSession(session: Session) {
    setLoadingStreams((prev) => ({ ...prev, [session.contentId]: true }))
    setError(null)
    try {
      const detailRes = await fetch(`/${locale}/api/f1tv/content?contentId=${session.contentId}`)
      if (!detailRes.ok) throw new Error("Falha ao carregar detalhes")
      const detail = await detailRes.json()

      const wif = detail.channels?.find((c: { identifier: string }) => c.identifier === "WIF")
      const channel = wif ?? detail.channels?.[0]
      const params = new URLSearchParams({ contentId: session.contentId.toString() })
      if (channel?.channelId) params.set("channelId", channel.channelId.toString())

      const streamRes = await fetch(`/${locale}/api/f1tv/streams?${params}`)
      if (!streamRes.ok) {
        const data = await streamRes.json().catch(() => ({}))
        throw new Error(data.error ?? "Stream indisponível")
      }
      const streamData = await streamRes.json()
      if (streamData.url) {
        onStreamReady(
          { url: streamData.url, streamType: streamData.streamType, laURL: streamData.laURL ?? null, drmToken: streamData.drmToken ?? null, channelId: channel?.channelId ?? 0 },
          session.contentId,
          `${selectedMeeting?.meeting ?? ""} — ${session.title}`,
          (detail.channels ?? []) as CameraChannel[],
        )
      } else {
        setError("Nenhum stream disponível")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no stream")
    } finally {
      setLoadingStreams((prev) => ({ ...prev, [session.contentId]: false }))
    }
  }

  if (selectedMeeting) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedMeeting(null); setSessions([]) }}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          >
            ← Voltar
          </button>
          <span className="text-xs text-gray-300 truncate">{selectedMeeting.meeting}</span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Carregando sessões…
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {sessions.map((s) => {
            const Icon = SUBTYPE_ICONS[s.contentSubtype] ?? Tv
            const isLoading = loadingStreams[s.contentId]
            return (
              <button
                key={s.contentId}
                onClick={() => selectSession(s)}
                disabled={isLoading}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-left transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 text-red-400 shrink-0 animate-spin" />
                ) : (
                  <Icon className="w-3 h-3 text-red-400 shrink-0" />
                )}
                <span className="text-xs text-gray-200 truncate flex-1">{s.title}</span>
                {s.duration > 0 && (
                  <span className="text-xs text-gray-500 shrink-0">{formatDuration(s.duration)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="bg-gray-800 text-xs text-gray-200 px-2 py-1 rounded border border-gray-700 focus:outline-none"
        >
          {Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i).map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadMeetings(query)}
            placeholder="Buscar corrida…"
            className="w-full bg-gray-800 text-xs text-gray-200 pl-7 pr-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Carregando…
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
        {meetings.map((m) => (
          <button
            key={m.contentId}
            onClick={() => openMeeting(m)}
            className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-left transition-colors"
          >
            <span className="text-xs text-gray-200 flex-1 truncate">{m.meeting}</span>
            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

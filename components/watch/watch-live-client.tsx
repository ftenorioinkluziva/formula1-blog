"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { AlertCircle, Camera, GripHorizontal, Loader2, Tv2, Wifi, WifiOff } from "lucide-react"
import { F1TVPlayer } from "@/components/live/f1tv-player"
import { MultiCamSelector, type CameraChannel } from "@/components/live/multi-cam-selector"

import type { F1TVPlaybackStream as StreamInfo } from "@/lib/f1tv/playback"

interface ContentInfo {
  contentId: number
  title: string
  meeting: string
  circuit: string
  channels: CameraChannel[]
}

export function WatchLiveClient() {
  const locale = useLocale()

  const [pageStatus, setPageStatus] = useState<"loading" | "no-session" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<ContentInfo | null>(null)

  const [wifStream, setWifStream] = useState<StreamInfo | null>(null)
  const [wifLoading, setWifLoading] = useState(false)
  const [obcStream, setObcStream] = useState<StreamInfo | null>(null)
  const [obcLoading, setObcLoading] = useState(false)
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [trackerStream, setTrackerStream] = useState<StreamInfo | null>(null)
  const [dataStream, setDataStream] = useState<StreamInfo | null>(null)
  const [mainRowHeightPct, setMainRowHeightPct] = useState(60)

  const mainAreaRef = useRef<HTMLDivElement>(null)
  const isRowDraggingRef = useRef(false)

  const fetchStream = useCallback(
    async (contentId: number, channelId: number): Promise<StreamInfo | null> => {
      const res = await fetch(`/${locale}/api/f1tv/streams?contentId=${contentId}&channelId=${channelId}`)
      if (!res.ok) return null
      const d = await res.json()
      return { url: d.url, streamType: d.streamType, laURL: d.laURL ?? null, drmToken: d.drmToken ?? null, channelId }
    },
    [locale],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      async function init() {
        try {
          const liveRes = await fetch(`/${locale}/api/f1tv/live`)
          if (!liveRes.ok) {
            if (liveRes.status === 401) {
              setError("F1TV não autenticado — acesse /admin/f1tv para configurar")
              setPageStatus("error")
              return
            }
            throw new Error(`Live check failed: ${liveRes.status}`)
          }

          const liveData = await liveRes.json()
          if (!liveData.sessions || liveData.sessions.length === 0) {
            setPageStatus("no-session")
            return
          }

          const liveSession = liveData.sessions.find((s: { isOnAir: boolean }) => s.isOnAir) ?? liveData.sessions[0]
          if (cancelled) return

          const contentRes = await fetch(`/${locale}/api/f1tv/content?contentId=${liveSession.contentId}`)
          if (!contentRes.ok) throw new Error("Failed to load content")
          const contentData = await contentRes.json()
          if (cancelled) return

          const channels: CameraChannel[] = contentData.channels ?? []
          const contentId = contentData.contentId as number
          setContent({
            contentId,
            title: contentData.title,
            meeting: contentData.meeting,
            circuit: contentData.circuit,
            channels,
          })

          const wifCh = channels.find((c) => c.identifier === "WIF")
          const obcCh = channels.filter((c) => c.identifier === "OBC")[0] ?? null
          const trackerCh = channels.find((c) => c.identifier === "TRACKER") ?? null
          const dataCh = channels.find((c) => c.identifier === "DATA") ?? null

          if (wifCh) {
            setWifLoading(true)
            fetchStream(contentId, wifCh.channelId)
              .then((s) => { if (!cancelled && s) setWifStream(s) })
              .catch(() => {})
              .finally(() => { if (!cancelled) setWifLoading(false) })
          }

          if (obcCh) {
            setActiveChannelId(obcCh.channelId)
            setObcLoading(true)
            fetchStream(contentId, obcCh.channelId)
              .then((s) => { if (!cancelled && s) setObcStream(s) })
              .catch(() => {})
              .finally(() => { if (!cancelled) setObcLoading(false) })
          }

          if (trackerCh) {
            fetchStream(contentId, trackerCh.channelId)
              .then((s) => { if (!cancelled && s) setTrackerStream(s) })
              .catch(() => {})
          }

          if (dataCh) {
            fetchStream(contentId, dataCh.channelId)
              .then((s) => { if (!cancelled && s) setDataStream(s) })
              .catch(() => {})
          }

          setPageStatus("ready")
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Erro desconhecido")
            setPageStatus("error")
          }
        }
      }

      init()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [locale, fetchStream])

  const handleObcSelect = useCallback(
    async (channel: CameraChannel) => {
      if (!content) return
      setActiveChannelId(channel.channelId)
      setObcLoading(true)
      setObcStream(null)
      fetchStream(content.contentId, channel.channelId)
        .then((s) => { if (s) setObcStream(s) })
        .catch(() => {})
        .finally(() => setObcLoading(false))
    },
    [content, fetchStream],
  )

  const handleRowDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isRowDraggingRef.current = true
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    const onMouseMove = (ev: MouseEvent) => {
      if (!isRowDraggingRef.current || !mainAreaRef.current) return
      const rect = mainAreaRef.current.getBoundingClientRect()
      const rawPct = ((ev.clientY - rect.top) / rect.height) * 100
      setMainRowHeightPct(Math.min(85, Math.max(25, rawPct)))
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

  if (pageStatus === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-zinc-400 text-sm">Verificando sessão ao vivo…</p>
        </div>
      </div>
    )
  }

  if (pageStatus === "error") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3 max-w-md px-4 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (pageStatus === "no-session") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <WifiOff className="h-8 w-8 text-zinc-600" />
          <p className="text-zinc-400 text-sm">Nenhuma sessão ao vivo no momento</p>
          <p className="text-zinc-600 text-xs">Volte durante um fim de semana de corrida</p>
        </div>
      </div>
    )
  }

  const obcChannels = content?.channels.filter((c) => c.identifier === "OBC") ?? []
  const hasBottomRow = !!(trackerStream || dataStream)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="shrink-0 border-b border-gray-800 px-4 py-2 flex items-center gap-2 min-w-0">
        <Tv2 className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-100 shrink-0">Engineer Board</span>
        <span className="flex items-center gap-1 text-xs text-green-400 font-medium shrink-0">
          <Wifi className="w-3 h-3" />
          Ao Vivo
        </span>
        {content && (
          <>
            <div className="mx-1 h-4 w-px bg-gray-700 shrink-0" />
            <span className="text-xs text-gray-300 truncate">
              {content.meeting} — {content.title}
            </span>
            <span className="text-xs text-gray-500 shrink-0 ml-1">{content.circuit}</span>
          </>
        )}
      </header>

      <div ref={mainAreaRef} className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Top row: WIF (left) + OBC selecionável (right) */}
        <div
          style={{ height: hasBottomRow ? `${mainRowHeightPct}%` : "100%", minHeight: 0, flexShrink: 0 }}
          className="flex gap-px"
        >
          {/* World Feed */}
          <div className="flex-1 relative min-w-0">
            <span className="absolute top-1 left-1 z-10 text-[10px] bg-black/70 text-gray-300 px-1.5 py-0.5 rounded pointer-events-none">
              World Feed
            </span>
            {wifLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            <F1TVPlayer
              streamUrl={wifStream?.url ?? null}
              streamType={wifStream?.streamType}
              laURL={wifStream?.laURL}
              drmToken={wifStream?.drmToken}
              locale={locale}
              autoPlay
              className="w-full h-full"
              alwaysShowControls
            />
            {!wifStream && !wifLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Camera className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </div>

          {/* OBC */}
          <div className="flex-1 relative min-w-0">
            {obcLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            <F1TVPlayer
              streamUrl={obcStream?.url ?? null}
              streamType={obcStream?.streamType}
              laURL={obcStream?.laURL}
              drmToken={obcStream?.drmToken}
              locale={locale}
              autoPlay
              className="w-full h-full"
              alwaysShowControls
            />
            {!obcStream && !obcLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
                <Camera className="w-8 h-8 text-gray-600" />
                <p className="text-gray-500 text-xs">Selecione um OBC</p>
              </div>
            )}
            {obcChannels.length > 0 && (
              <div className="absolute top-1 left-1 z-20">
                <MultiCamSelector
                  channels={obcChannels}
                  activeChannelId={activeChannelId}
                  onChannelSelect={handleObcSelect}
                />
              </div>
            )}
          </div>
        </div>

        {/* Row resize handle */}
        {hasBottomRow && (
          <div
            onMouseDown={handleRowDividerMouseDown}
            className="shrink-0 h-6 cursor-row-resize bg-gray-900 border-y border-gray-700/60 flex items-center justify-center select-none"
          >
            <GripHorizontal className="w-3 h-3 text-gray-600 pointer-events-none" />
          </div>
        )}

        {/* Bottom row: Tracker + Data Channel */}
        {hasBottomRow && (
          <div style={{ flex: "1 1 0", minHeight: 0 }} className="flex gap-px">
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
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

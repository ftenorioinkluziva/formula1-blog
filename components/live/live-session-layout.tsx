"use client"

import { useState, useCallback, useEffect } from "react"
import { useLocale } from "next-intl"
import { AlertCircle, Loader2, Wifi, WifiOff } from "lucide-react"
import { F1TVPlayer } from "./f1tv-player"
import { MultiCamSelector, type CameraChannel } from "./multi-cam-selector"
import type { F1TVPlaybackStream as StreamInfo } from "@/lib/f1tv/playback"
import {
  LiveTimingProvider,
  TimingTable,
  SessionCompactHeader,
  TeamRadioList,
  ConnectionStatus,
} from "@/components/live-timing"

interface ContentInfo {
  contentId: number
  title: string
  meeting: string
  circuit: string
  isOnAir: boolean
  channels: CameraChannel[]
}


export function LiveSessionLayout() {
  const locale = useLocale()

  const [status, setStatus] = useState<"loading" | "no-session" | "ready" | "error">("loading")
  const [content, setContent] = useState<ContentInfo | null>(null)
  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [activeChannel, setActiveChannel] = useState<CameraChannel | null>(null)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const loadStream = useCallback(async (contentId: number, channelId: number) => {
    try {
      const res = await fetch(
        `/${locale}/api/f1tv/streams?contentId=${contentId}&channelId=${channelId}`
      )
      if (!res.ok) throw new Error("Stream unavailable")

      const data = await res.json()
      setStream({ url: data.url, streamType: data.streamType, laURL: data.laURL ?? null, drmToken: data.drmToken ?? null, channelId })
    } catch (err) {
      setStream(null)
      setError(err instanceof Error ? err.message : "Stream error")
    }
  }, [locale])

  useEffect(() => {
    let cancelled = false

    async function checkLive() {
      try {
        const res = await fetch(`/${locale}/api/f1tv/live`)
        if (!res.ok) {
          if (res.status === 401) {
            setError("F1TV not authenticated — run pnpm f1tv:login")
            setStatus("error")
            return
          }
          throw new Error(`Live check failed: ${res.status}`)
        }

        const data = await res.json()
        if (!data.sessions || data.sessions.length === 0) {
          setStatus("no-session")
          return
        }

        const liveSession = data.sessions.find((s: { isOnAir: boolean }) => s.isOnAir) ?? data.sessions[0]
        if (cancelled) return

        const contentRes = await fetch(
          `/${locale}/api/f1tv/content?contentId=${liveSession.contentId}`
        )
        if (!contentRes.ok) throw new Error("Failed to load content")

        const contentData = await contentRes.json()
        if (cancelled) return

        setContent({
          contentId: contentData.contentId,
          title: contentData.title,
          meeting: contentData.meeting,
          circuit: contentData.circuit,
          isOnAir: contentData.isOnAir,
          channels: contentData.channels,
        })
        setPlaybackPosition(0)

        const wif = contentData.channels.find(
          (c: CameraChannel) => c.identifier === "WIF"
        )
        if (wif) {
          setActiveChannel(wif)
          await loadStream(liveSession.contentId, wif.channelId)
        }

        setStatus("ready")
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error")
          setStatus("error")
        }
      }
    }

    checkLive()
    return () => { cancelled = true }
  }, [locale, loadStream])

  const handleChannelSelect = useCallback(
    async (channel: CameraChannel) => {
      setActiveChannel(channel)
      if (content) {
        await loadStream(content.contentId, channel.channelId)
      }
    },
    [content, loadStream]
  )

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-zinc-400 text-sm">Checking for live sessions...</p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md px-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      </div>
    )
  }

  if (status === "no-session") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <WifiOff className="h-8 w-8 text-zinc-600" />
          <p className="text-zinc-400 text-sm">No live session at the moment</p>
          <p className="text-zinc-600 text-xs">Check back during a race weekend</p>
        </div>
      </div>
    )
  }

  return (
    <LiveTimingProvider>
      <div className="min-h-screen bg-[#0f0f0f] pt-16 pb-4">
        <div className="max-w-480 mx-auto px-2">
          {content && (
            <div className="flex items-center gap-3 mb-2 px-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <h1 className="text-white text-sm font-medium">
                {content.meeting} — {content.title}
              </h1>
              <span className="text-zinc-500 text-xs">{content.circuit}</span>
              <div className="ml-auto">
                <ConnectionStatus />
              </div>
            </div>
          )}

          {content && content.channels.length > 0 && (
            <div className="mb-2 px-2">
              <MultiCamSelector
                channels={content.channels}
                activeChannelId={activeChannel?.channelId ?? null}
                onChannelSelect={handleChannelSelect}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-5 space-y-2">
              <F1TVPlayer
                streamUrl={stream?.url ?? null}
                streamType={stream?.streamType}
                laURL={stream?.laURL}
                drmToken={stream?.drmToken}
                locale={locale}
                resumeAtSeconds={playbackPosition}
                onTimeUpdate={setPlaybackPosition}
                className="aspect-video"
              />
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <TeamRadioList />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <SessionCompactHeader />
              <TimingTable />
            </div>
          </div>
        </div>
      </div>
    </LiveTimingProvider>
  )
}

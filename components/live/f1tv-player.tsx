"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Hls from "hls.js"
import { Loader2, AlertCircle, Volume2, VolumeX, Maximize, Pause, Play, Settings } from "lucide-react"
import { getPlaybackLicenseUrl } from "@/lib/f1tv/playback"

interface QualityLevel {
  index: number
  height: number
  bitrate: number
}

interface AudioTrackInfo {
  index: number
  id: string
  name: string
  lang: string
}

interface F1TVPlayerProps {
  streamUrl: string | null
  streamType?: string
  laURL?: string | null
  drmToken?: string | null
  locale?: string
  resumeAtSeconds?: number
  forceSyncKey?: number
  autoPlay?: boolean
  className?: string
  onTimeUpdate?: (currentTime: number) => void
  onError?: (error: string) => void
  alwaysShowControls?: boolean
  syncOffsetSeconds?: number
  onSyncOffsetChange?: (newOffset: number) => void
}

interface PlayerController {
  destroy: () => void
  seek?: (time: number) => void
  setQuality?: (index: number) => void
  setAudioTrackById?: (id: string, tracks: AudioTrackInfo[]) => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

function formatQualityLabel(level: QualityLevel): string {
  if (level.height > 0) return `${level.height}p`
  return `${Math.round(level.bitrate / 1000)}k`
}

function isDashStreamUrl(streamUrl: string): boolean {
  try {
    return new URL(streamUrl).pathname.toLowerCase().endsWith(".mpd")
  } catch {
    return streamUrl.split("?")[0].toLowerCase().endsWith(".mpd")
  }
}

export function F1TVPlayer({
  streamUrl,
  streamType = "HLS",
  laURL,
  drmToken,
  locale,
  resumeAtSeconds = 0,
  forceSyncKey = 0,
  autoPlay = true,
  className = "",
  onTimeUpdate,
  onError,
  alwaysShowControls = false,
  syncOffsetSeconds,
  onSyncOffsetChange,
}: F1TVPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ttmlRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerController | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "idle">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([])
  const [currentAudioTrackId, setCurrentAudioTrackId] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const retryCountRef = useRef(0)
  const latestResumeAtRef = useRef(0)
  const pendingResumeAtRef = useRef<number | null>(null)
  const currentAudioTrackIdRef = useRef<string | null>(null)
  const audioTracksInitializedRef = useRef(false)
  const onTimeUpdateRef = useRef(onTimeUpdate)

  const cleanup = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
  }, [])

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
    const total = Math.floor(seconds)
    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = total % 60

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    }
    return `${mins}:${String(secs).padStart(2, "0")}`
  }, [])

  const applyPendingResume = useCallback((video: HTMLVideoElement, controller?: PlayerController | null) => {
    const target = pendingResumeAtRef.current
    if (target === null || !Number.isFinite(target) || target <= 0) return

    let nextTime = target
    if (Number.isFinite(video.duration) && video.duration > 0) {
      nextTime = Math.min(target, Math.max(video.duration - 0.25, 0))
    }

    try {
      if (controller?.seek) {
        controller.seek(nextTime)
      } else {
        video.currentTime = nextTime
      }
      setCurrentTime(nextTime)
      onTimeUpdateRef.current?.(nextTime)
      pendingResumeAtRef.current = null
    } catch {
      // Ignore transient seek failures while stream is still buffering.
    }
  }, [])

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
  }, [onTimeUpdate])

  useEffect(() => {
    latestResumeAtRef.current = resumeAtSeconds
  }, [resumeAtSeconds])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl || !Number.isFinite(resumeAtSeconds) || resumeAtSeconds <= 0) return
    if (Math.abs(video.currentTime - resumeAtSeconds) < 3) return
    try {
      if (playerRef.current?.seek) {
        playerRef.current.seek(resumeAtSeconds)
      } else {
        video.currentTime = resumeAtSeconds
      }
    } catch { /* ignore transient seek failures */ }
  }, [resumeAtSeconds, streamUrl])

  useEffect(() => {
    if (!forceSyncKey) return
    const video = videoRef.current
    const target = latestResumeAtRef.current
    if (!video || !Number.isFinite(target) || target <= 0) return
    try {
      if (playerRef.current?.seek) {
        playerRef.current.seek(target)
      } else {
        video.currentTime = target
      }
    } catch { /* ignore transient seek failures */ }
  }, [forceSyncKey])

  useEffect(() => {
    currentAudioTrackIdRef.current = currentAudioTrackId
  }, [currentAudioTrackId])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) {
      setStatus("idle")
      return
    }

    cleanup()
    setStatus("loading")
    setErrorMessage(null)
    setCurrentTime(0)
    setDuration(0)
    setQualityLevels([])
    setCurrentQuality(-1)
    setAudioTracks([])
    setCurrentAudioTrackId(null)
    currentAudioTrackIdRef.current = null
    setShowSettings(false)
    retryCountRef.current = 0
    audioTracksInitializedRef.current = false
    pendingResumeAtRef.current = latestResumeAtRef.current > 0 ? latestResumeAtRef.current : null

    const isDash = streamType.toUpperCase().includes("DASH") || isDashStreamUrl(streamUrl)

    if (isDash) {
      import("dashjs").then(async (dashjs) => {
        try {
          const player = dashjs.MediaPlayer().create()

          const settings: Parameters<typeof player.updateSettings>[0] = {
            debug: {
              logLevel: 0,
            },
            streaming: {
              buffer: { fastSwitchEnabled: true },
              text: { defaultEnabled: false },
              capabilities: {
                useMediaCapabilitiesApi: false,
              },
            },
          }
          player.updateSettings(settings)

          if (ttmlRef.current && typeof player.attachTTMLRenderingDiv === "function") {
            try {
              player.attachTTMLRenderingDiv(ttmlRef.current)
            } catch (error) {
              console.warn("[f1tv-player] TTML setup failed, continuing without subtitle rendering", error)
            }
          }

          if (laURL) {
            const licenseUrl = getPlaybackLicenseUrl(locale, laURL)
            const protectionData: Record<string, unknown> = {
              serverURL: licenseUrl,
              withCredentials: false,
            }
            if (drmToken) {
              protectionData.httpRequestHeaders = { "x-f1tv-drm-token": drmToken }
            }
            player.setProtectionData({ "com.widevine.alpha": protectionData })
          }

          player.initialize(video, streamUrl, autoPlay)

          playerRef.current = {
            destroy: () => player.destroy(),
            seek: (time: number) => player.seek(time),
            setQuality: (index: number) => {
              if (index === -1) {
                player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } })
              } else {
                player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } })
                const p = player as unknown as { setQualityFor?: (type: string, idx: number) => void }
                p.setQualityFor?.("video", index)
              }
            },
            setAudioTrackById: (id: string, infos: AudioTrackInfo[]) => {
              try {
                const allTracks = player.getTracksFor("audio")
                const match = infos.find((t) => t.id === id)
                if (match !== undefined && Array.isArray(allTracks) && allTracks[match.index]) {
                  player.setCurrentTrack(allTracks[match.index])
                }
              } catch { /* ignore if unsupported */ }
            },
          }

          player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
            applyPendingResume(video, playerRef.current)
            setStatus("ready")

            try {
              const p = player as unknown as { getBitrateInfoListFor?: (type: string) => unknown[] }
              const bitrateList = p.getBitrateInfoListFor?.("video")
              if (Array.isArray(bitrateList) && bitrateList.length > 0) {
                const levels: QualityLevel[] = bitrateList.map((b, i) => ({
                  index: i,
                  height: (b as { height?: number }).height ?? 0,
                  bitrate: (b as { bitrate?: number }).bitrate ?? 0,
                }))
                levels.sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
                setQualityLevels(levels)
              }
            } catch { /* bitrate list not available on this stream */ }

            try {
              const tracks = player.getTracksFor("audio")
              if (Array.isArray(tracks) && tracks.length > 0) {
                if (!audioTracksInitializedRef.current) {
                  audioTracksInitializedRef.current = true
                  const infos: AudioTrackInfo[] = tracks.map((t, i) => {
                    const track = t as { id?: string; lang?: string | null; labels?: Array<{ text: string }> }
                    const name = track.labels?.[0]?.text ?? track.lang ?? `Track ${i + 1}`
                    const stableId = track.id ?? track.lang ?? name
                    return { index: i, id: stableId, name, lang: track.lang ?? "" }
                  })
                  setAudioTracks(infos)
                  const prevId = currentAudioTrackIdRef.current
                  const trackExists = prevId !== null && infos.some((t) => t.id === prevId)
                  const targetId = trackExists ? prevId : (infos[0]?.id ?? null)
                  if (!trackExists) setCurrentAudioTrackId(targetId)
                  if (targetId !== null) playerRef.current?.setAudioTrackById?.(targetId, infos)
                } else {
                  const prevId = currentAudioTrackIdRef.current
                  if (prevId !== null) playerRef.current?.setAudioTrackById?.(prevId, audioTracks)
                }
              }
            } catch { /* audio tracks not available on this stream */ }
          })

          player.on(dashjs.MediaPlayer.events.ERROR, (e: unknown) => {
            const err = (e as { error?: { message?: string; code?: number } })?.error
            const isDrmError = err?.code === 112 || String(err?.message ?? "").toLowerCase().includes("keysystem") || String(err?.message ?? "").toLowerCase().includes("drm")
            let msg: string
            if (isDrmError) {
              msg = `DRM: ${err?.message ?? "key system access denied"}. Verifique se o browser suporta Widevine (Chrome/Edge).`
              setTimeout(() => {
                if (video.readyState >= 2 || video.currentTime > 0) return
                setErrorMessage(msg)
                setStatus("error")
                onError?.(msg)
              }, 2000)
            } else {
              msg = `DASH error: ${err?.message ?? err?.code ?? "playback failed"}`
              if (retryCountRef.current < 3) {
                retryCountRef.current += 1
                setTimeout(() => setRetryKey((k) => k + 1), 3000)
              } else {
                setErrorMessage(msg)
                setStatus("error")
                onError?.(msg)
              }
            }
          })
        } catch (error) {
          const msg = error instanceof Error ? `Failed to load DASH player: ${error.message}` : "Failed to load DASH player"
          setErrorMessage(msg)
          setStatus("error")
          onError?.(msg)
        }
      }).catch((err) => {
        const msg = err instanceof Error ? `Failed to load DASH player: ${err.message}` : "Failed to load DASH player"
        setErrorMessage(msg)
        setStatus("error")
        onError?.(msg)
      })
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      })
      playerRef.current = {
        destroy: () => hls.destroy(),
        seek: (time: number) => { video.currentTime = time },
        setQuality: (index: number) => { hls.currentLevel = index },
        setAudioTrackById: (_id: string) => {
          const idx = hls.audioTracks.findIndex((t, i) => (t.name || t.lang || String(i)) === _id)
          if (idx >= 0) hls.audioTrack = idx
        },
      }

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels: QualityLevel[] = data.levels.map((l, i) => ({
          index: i,
          height: l.height ?? 0,
          bitrate: l.bitrate,
        }))
        levels.sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
        setQualityLevels(levels)
        setCurrentQuality(-1)
        setStatus("ready")
        if (autoPlay) {
          video.play().catch(() => {})
        }
      })

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        const infos: AudioTrackInfo[] = data.audioTracks.map((t, i) => ({
          index: i,
          id: t.name || t.lang || String(i),
          name: t.name,
          lang: t.lang ?? "",
        }))
        setAudioTracks(infos)
        if (!audioTracksInitializedRef.current) {
          audioTracksInitializedRef.current = true
          const prevId = currentAudioTrackIdRef.current
          const trackExists = prevId !== null && infos.some((t) => t.id === prevId)
          const activeIdx = hls.audioTrack >= 0 ? hls.audioTrack : 0
          const targetId = trackExists ? prevId : (infos[activeIdx]?.id ?? infos[0]?.id ?? null)
          if (!trackExists) {
            setCurrentAudioTrackId(targetId)
            currentAudioTrackIdRef.current = targetId
          }
          const targetInfo = infos.find((t) => t.id === targetId)
          if (targetInfo && hls.audioTrack !== targetInfo.index) {
            hls.audioTrack = targetInfo.index
          }
        } else {
          const desiredId = currentAudioTrackIdRef.current
          if (desiredId !== null) {
            const targetInfo = infos.find((t) => t.id === desiredId)
            if (targetInfo && hls.audioTrack !== targetInfo.index) {
              hls.audioTrack = targetInfo.index
            }
          }
        }
      })

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
        const desiredId = currentAudioTrackIdRef.current
        if (desiredId === null) return
        const idx = hls.audioTracks.findIndex((t, i) => (t.name || t.lang || String(i)) === desiredId)
        if (idx >= 0 && data.id !== idx) {
          hls.audioTrack = idx
        }
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const msg = `HLS error: ${data.type} - ${data.details}`
          setErrorMessage(msg)
          setStatus("error")
          onError?.(msg)

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          }
        }
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl
      video.addEventListener("loadedmetadata", () => {
        setStatus("ready")
        if (autoPlay) video.play().catch(() => {})
      })
    } else {
      setErrorMessage("Playback not supported in this browser")
      setStatus("error")
    }

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, streamType, autoPlay, cleanup, onError, retryKey])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdateRef.current?.(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
      applyPendingResume(video, playerRef.current)
    }

    const handleDurationChange = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
      applyPendingResume(video, playerRef.current)
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("durationchange", handleDurationChange)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("durationchange", handleDurationChange)
    }
  }, [applyPendingResume])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    return () => {
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen().catch(() => {})
    }
  }, [])

  const stepBy = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const newTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : Infinity, video.currentTime + seconds))
    video.currentTime = newTime
    setCurrentTime(newTime)
    onTimeUpdateRef.current?.(newTime)
  }, [])

  const handleSeek = useCallback((value: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(duration) || duration <= 0) return
    video.currentTime = value
    setCurrentTime(value)
    onTimeUpdateRef.current?.(value)
  }, [duration])

  useEffect(() => {
    if (!streamUrl) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          stepBy(e.shiftKey ? -(1 / 30) : e.ctrlKey ? -30 : -5)
          break
        case "ArrowRight":
          e.preventDefault()
          stepBy(e.shiftKey ? 1 / 30 : e.ctrlKey ? 30 : 5)
          break
        case " ":
          e.preventDefault()
          togglePlay()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [streamUrl, stepBy, togglePlay])

  const handleQualityChange = (index: number) => {
    setCurrentQuality(index)
    playerRef.current?.setQuality?.(index)
  }

  const handleAudioTrackChange = (id: string) => {
    currentAudioTrackIdRef.current = id
    setCurrentAudioTrackId(id)
    playerRef.current?.setAudioTrackById?.(id, audioTracks)
  }

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current
    if (video) video.playbackRate = speed
    setPlaybackSpeed(speed)
  }

  useEffect(() => {
    if (!showSettings) return
    const onMouseDown = (e: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [showSettings])

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={isMuted}
        playsInline
        crossOrigin="anonymous"
      />
      <div ref={ttmlRef} className="pointer-events-none absolute inset-0 z-10" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-400 text-sm text-center">{errorMessage}</p>
        </div>
      )}

      {status === "idle" && !streamUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <p className="text-zinc-500 text-sm">Select a stream to start playback</p>
        </div>
      )}

      {status === "ready" && (
        <div className={`absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/80 to-transparent transition-opacity ${(alwaysShowControls || showSettings) ? "opacity-100" : "opacity-0 hover:opacity-100"}`}>
          {showSettings && (
            <div
              ref={settingsPanelRef}
              className="absolute bottom-14 right-2 z-20 bg-zinc-900/95 border border-zinc-700 rounded-lg overflow-hidden min-w-52.5 shadow-xl"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <span className="text-zinc-400 text-[11px] font-medium">Video Quality</span>
                <select
                  value={currentQuality}
                  onChange={(e) => handleQualityChange(Number(e.target.value))}
                  className="bg-zinc-800 text-zinc-100 text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer border-0"
                >
                  <option value={-1}>auto</option>
                  {qualityLevels.map((l) => (
                    <option key={l.index} value={l.index}>{formatQualityLabel(l)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <span className="text-zinc-400 text-[11px] font-medium">Speed</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="bg-zinc-800 text-zinc-100 text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer border-0"
                >
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === 1 ? "Normal" : `${s}×`}</option>
                  ))}
                </select>
              </div>

              {audioTracks.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-zinc-400 text-[11px] font-medium">Audio Track</span>
                  <select
                    value={currentAudioTrackId ?? ""}
                    onChange={(e) => handleAudioTrackChange(e.target.value)}
                    className="bg-zinc-800 text-zinc-100 text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer border-0 max-w-27.5"
                  >
                    {audioTracks.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-zinc-200 tabular-nums min-w-10.5">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="flex-1 h-1.5 accent-red-500 cursor-pointer"
              disabled={duration <= 0}
            />
            <span className="text-[11px] text-zinc-200 tabular-nums min-w-10.5 text-right">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { videoRef.current?.pause(); setIsPlaying(false); stepBy(-(1 / 25)) }}
              className="text-[10px] text-zinc-400 hover:text-white px-1 py-1 rounded hover:bg-white/10"
              title="Frame anterior (Shift+←)"
            >
              ◀
            </button>
            <button onClick={togglePlay} className="text-white hover:text-zinc-300 p-1">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { videoRef.current?.pause(); setIsPlaying(false); stepBy(1 / 25) }}
              className="text-[10px] text-zinc-400 hover:text-white px-1 py-1 rounded hover:bg-white/10"
              title="Próximo frame (Shift+→)"
            >
              ▶
            </button>
            <div className="flex items-center gap-0.5 mx-1">
              {([-10, -1] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => stepBy(s)}
                  className="text-[10px] text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 tabular-nums"
                >
                  {s}s
                </button>
              ))}
              {([1, 10] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => stepBy(s)}
                  className="text-[10px] text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 tabular-nums"
                >
                  +{s}s
                </button>
              ))}
            </div>
            {onSyncOffsetChange !== undefined && (
              <div className="flex items-center gap-0.5 mx-1 border-l border-zinc-700 pl-2">
                {([-0.5, -0.1] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSyncOffsetChange(Math.round((syncOffsetSeconds ?? 0) + s * 10) / 10)}
                    className="text-[10px] text-blue-400 hover:text-blue-200 px-1 py-0.5 rounded hover:bg-white/10 tabular-nums"
                  >
                    {s}s
                  </button>
                ))}
                <span className="text-[10px] text-blue-300 font-mono tabular-nums px-1">
                  {(syncOffsetSeconds ?? 0) >= 0 ? "+" : ""}{(syncOffsetSeconds ?? 0).toFixed(1)}s
                </span>
                {([0.1, 0.5] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSyncOffsetChange(Math.round((syncOffsetSeconds ?? 0) + s * 10) / 10)}
                    className="text-[10px] text-blue-400 hover:text-blue-200 px-1 py-0.5 rounded hover:bg-white/10 tabular-nums"
                  >
                    +{s}s
                  </button>
                ))}
              </div>
            )}
            <button onClick={toggleMute} className="text-white hover:text-zinc-300 p-1">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowSettings((s) => !s)}
              className={`p-1 transition-colors ${showSettings ? "text-red-400" : "text-white hover:text-zinc-300"}`}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={toggleFullscreen} className="text-white hover:text-zinc-300 p-1">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

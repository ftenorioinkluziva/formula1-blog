"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Play, ChevronRight, Image as ImageIcon, Film, Headphones, MapPin, Loader2, Clock, BarChart3, ArrowLeft } from "lucide-react"
import { useLocale } from "next-intl"
import { GalleryViewer } from "@/components/gallery-viewer"
import { F1TVPlayer } from "@/components/live/f1tv-player"
import { MultiCamSelector, type CameraChannel } from "@/components/live/multi-cam-selector"

interface F1TVMeeting {
  contentId: number
  title: string
  meeting: string
  circuit: string
  pictureUrl: string | null
  detailUri: string | null
}

interface F1TVSession {
  contentId: number
  title: string
  duration: number
  contentSubtype: string
  pictureUrl: string | null
  isOnAir: boolean
}

interface F1TVContentDetail {
  contentId: number
  title: string
  meeting: string
  channels: CameraChannel[]
}

import type { F1TVPlaybackStream as F1TVStreamInfo } from "@/lib/f1tv/playback"

interface MultimediaGallery {
  id: number
  title: string
  count: number
  category: string
  coverImageUrl: string | null
}

interface MultimediaPodcast {
  id: number
  title: string
  episode: string
  duration: string
  guest: string
  description: string | null
  audioUrl: string | null
  publishedAt: string | null
  language: string
}

interface MultimediaApiResponse {
  galleries: MultimediaGallery[]
  podcasts: MultimediaPodcast[]
}

const tabs = [
  { key: "videos", label: "Videos", icon: Film },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "podcasts", label: "Podcasts", icon: Headphones },
] as const

const CURRENT_SEASON = String(new Date().getFullYear())

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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function MultimediaSection() {
  const [activeTab, setActiveTab] = useState<string>("videos")
  const [galleries, setGalleries] = useState<MultimediaGallery[]>([])
  const [podcasts, setPodcasts] = useState<MultimediaPodcast[]>([])
  const [expandedPodcastId, setExpandedPodcastId] = useState<number | null>(null)
  const [f1tvMeetings, setF1tvMeetings] = useState<F1TVMeeting[]>([])
  const [activeGallery, setActiveGallery] = useState<MultimediaGallery | null>(null)

  const [f1tvSelectedMeeting, setF1tvSelectedMeeting] = useState<F1TVMeeting | null>(null)
  const [f1tvSessions, setF1tvSessions] = useState<F1TVSession[]>([])
  const [f1tvSelectedSession, setF1tvSelectedSession] = useState<F1TVContentDetail | null>(null)
  const [f1tvStream, setF1tvStream] = useState<F1TVStreamInfo | null>(null)
  const [f1tvActiveChannel, setF1tvActiveChannel] = useState<CameraChannel | null>(null)
  const [f1tvLoading, setF1tvLoading] = useState(false)
  const [f1tvError, setF1tvError] = useState<string | null>(null)

  const locale = useLocale()

  useEffect(() => {
    async function loadMultimedia() {
      try {
        const response = await fetch(`/${locale}/api/multimedia`, { cache: "no-store" })

        if (!response.ok) {
          setGalleries([])
          setPodcasts([])
          return
        }

        const data = (await response.json()) as MultimediaApiResponse
        setGalleries(data.galleries)
        setPodcasts(data.podcasts)
      } catch {
        setGalleries([])
        setPodcasts([])
      }
    }

    async function loadF1TVMeetings() {
      try {
        const res = await fetch(`/${locale}/api/f1tv/content?season=${CURRENT_SEASON}`)
        if (!res.ok) return
        const data = await res.json()
        setF1tvMeetings(Array.isArray(data) ? data : [])
      } catch {
        // F1TV not available — no-op
      }
    }

    loadMultimedia()
    loadF1TVMeetings()
  }, [locale])

  async function openF1TVMeeting(meeting: F1TVMeeting) {
    if (!meeting.detailUri) return
    setF1tvSelectedMeeting(meeting)
    setF1tvSessions([])
    setF1tvSelectedSession(null)
    setF1tvStream(null)
    setF1tvActiveChannel(null)
    setF1tvLoading(true)
    setF1tvError(null)

    try {
      const params = new URLSearchParams({ meetingUri: meeting.detailUri, season: CURRENT_SEASON })
      const res = await fetch(`/${locale}/api/f1tv/content?${params}`)
      if (!res.ok) throw new Error("Failed to load sessions")
      const data = await res.json()
      const sessions = Array.isArray(data) ? data : []
      setF1tvSessions(
        sessions.filter((session: F1TVSession) => session.contentSubtype.toUpperCase() !== "REPLAY")
      )
    } catch (err) {
      setF1tvError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setF1tvLoading(false)
    }
  }

  async function openF1TVSession(session: F1TVSession) {
    setF1tvLoading(true)
    setF1tvError(null)
    setF1tvStream(null)
    setF1tvActiveChannel(null)

    try {
      const res = await fetch(`/${locale}/api/f1tv/content?contentId=${session.contentId}`)
      if (!res.ok) throw new Error("Failed to load content details")

      const detail: F1TVContentDetail = await res.json()
      setF1tvSelectedSession(detail)

      const wif = detail.channels.find((c) => c.identifier === "WIF")
      const firstChannel = wif ?? detail.channels[0]

      if (firstChannel) {
        setF1tvActiveChannel(firstChannel)
        await loadF1TVStream(session.contentId, firstChannel.channelId)
      } else {
        await loadF1TVStream(session.contentId)
      }
    } catch (err) {
      setF1tvError(err instanceof Error ? err.message : "Failed to load session")
    } finally {
      setF1tvLoading(false)
    }
  }

  async function loadF1TVStream(contentId: number, channelId?: number) {
    try {
      const params = new URLSearchParams({ contentId: contentId.toString() })
      if (channelId) params.set("channelId", channelId.toString())

      const res = await fetch(`/${locale}/api/f1tv/streams?${params}`)
      if (!res.ok) throw new Error("Stream unavailable")

      const data = await res.json()
      if (data.url) {
        setF1tvStream({
          url: data.url,
          streamType: data.streamType,
          laURL: data.laURL ?? null,
          drmToken: data.drmToken ?? null,
          channelId: channelId ?? 0,
        })
      } else {
        setF1tvError("No playable stream found")
      }
    } catch (err) {
      setF1tvError(err instanceof Error ? err.message : "Stream error")
    }
  }

  async function handleF1TVChannelSelect(channel: CameraChannel) {
    setF1tvActiveChannel(channel)
    if (f1tvSelectedSession) {
      setF1tvStream(null)
      await loadF1TVStream(f1tvSelectedSession.contentId, channel.channelId)
    }
  }

  function closeF1TVPlayer() {
    setF1tvSelectedSession(null)
    setF1tvStream(null)
    setF1tvActiveChannel(null)
    setF1tvError(null)
  }

  function closeF1TVMeeting() {
    setF1tvSelectedMeeting(null)
    setF1tvSelectedSession(null)
    setF1tvSessions([])
    setF1tvStream(null)
    setF1tvActiveChannel(null)
    setF1tvError(null)
  }

  return (
    <>
      {activeGallery && (
        <GalleryViewer
          galleryId={activeGallery.id}
          galleryTitle={activeGallery.title}
          galleryCategory={activeGallery.category}
          locale={locale}
          onClose={() => setActiveGallery(null)}
        />
      )}

      <section id="multimedia" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="multimedia-heading">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
                Watch & Listen
              </span>
              <h2
                id="multimedia-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
              >
                Multimedia
              </h2>
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              View All Media
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 sm:gap-1 mb-6 sm:mb-8 border-b border-border overflow-x-auto no-scrollbar" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap shrink-0 ${
                    activeTab === tab.key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Videos Tab */}
          {activeTab === "videos" && (
            <div className="space-y-6">
              {f1tvSelectedSession ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={closeF1TVPlayer}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {f1tvSelectedMeeting?.meeting} — {f1tvSelectedSession.title}
                    </h3>
                  </div>

                  {f1tvSelectedSession.channels.length > 0 && (
                    <MultiCamSelector
                      channels={f1tvSelectedSession.channels}
                      activeChannelId={f1tvActiveChannel?.channelId ?? null}
                      onChannelSelect={handleF1TVChannelSelect}
                    />
                  )}

                  <F1TVPlayer
                    streamUrl={f1tvStream?.url ?? null}
                    streamType={f1tvStream?.streamType}
                    laURL={f1tvStream?.laURL}
                    drmToken={f1tvStream?.drmToken}
                    locale={locale}
                    className="aspect-video max-h-[70vh] rounded-sm"
                  />
                </div>
              ) : f1tvSelectedMeeting ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={closeF1TVMeeting}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {f1tvSelectedMeeting.meeting}
                    </h3>
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">{f1tvSelectedMeeting.circuit}</span>
                  </div>

                  {f1tvError && <p className="text-destructive text-sm">{f1tvError}</p>}

                  {f1tvLoading && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {f1tvSessions.map((session) => {
                      const Icon = SUBTYPE_ICONS[session.contentSubtype] ?? Film
                      const label = SUBTYPE_LABELS[session.contentSubtype] ?? session.contentSubtype

                      return (
                        <button
                          key={session.contentId}
                          onClick={() => openF1TVSession(session)}
                          className="w-full flex items-center gap-3 bg-card hover:bg-secondary rounded-sm px-4 py-3 text-left transition-colors border border-border hover:border-foreground/20"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-bold text-foreground flex-1 truncate">
                            {session.title}
                          </span>
                          <span className="text-muted-foreground text-[10px] sm:text-xs shrink-0 px-2 py-0.5 rounded-sm bg-secondary font-bold uppercase tracking-wider">
                            {label}
                          </span>
                          {session.duration > 0 && (
                            <span className="text-muted-foreground text-[10px] sm:text-xs shrink-0 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration)}
                            </span>
                          )}
                          {session.isOnAir && (
                            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0">
                              LIVE
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      )
                    })}
                  </div>

                  {!f1tvLoading && f1tvSessions.length === 0 && !f1tvError && (
                    <p className="text-muted-foreground text-sm text-center py-8">No sessions available</p>
                  )}
                </div>
              ) : (
                <>
                  {f1tvMeetings.length > 0 && (
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground mb-3">
                        F1TV — {CURRENT_SEASON} Season
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {f1tvMeetings.map((meeting) => (
                          <article
                            key={meeting.contentId}
                            className="group cursor-pointer"
                            onClick={() => openF1TVMeeting(meeting)}
                          >
                            <div className="relative aspect-video rounded-sm overflow-hidden mb-2.5 sm:mb-3 bg-secondary">
                              {meeting.pictureUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`https://f1tv.formula1.com/image-resizer/image/${meeting.pictureUrl}?w=640&h=360&q=HI&o=L`}
                                  alt={meeting.meeting}
                                  className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-300"
                                />
                              )}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/90 rounded-full flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform">
                                  <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" />
                                </div>
                              </div>
                              <span className="absolute top-2 left-2 px-2 py-0.5 bg-background/80 backdrop-blur-sm rounded-sm text-[10px] font-bold uppercase tracking-widest text-foreground">
                                F1TV
                              </span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
                              {meeting.meeting}
                            </h4>
                            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {meeting.circuit}
                            </span>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === "photos" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {galleries.map((gallery) => (
                <article
                  key={gallery.id}
                  className="group cursor-pointer relative aspect-4/3 rounded-sm overflow-hidden"
                  onClick={() => setActiveGallery(gallery)}
                >
                  <Image
                    src={gallery.coverImageUrl ?? "/placeholder.svg?height=400&width=540"}
                    alt={gallery.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 block">
                      {gallery.category}
                    </span>
                    <h4 className="text-base sm:text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {gallery.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                      <ImageIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{gallery.count} images</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Podcasts Tab */}
          {activeTab === "podcasts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {podcasts.map((podcast) => (
                <article
                  key={podcast.id}
                  className="group flex flex-col gap-3 sm:gap-4 p-3.5 sm:p-4 bg-card rounded-sm border border-border hover:border-foreground/20 active:border-foreground/20 transition-all"
                >
                  <div className="flex gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-sm bg-secondary flex items-center justify-center">
                      <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5 sm:mb-1 block">
                        {podcast.episode}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
                        {podcast.title}
                      </h4>
                      <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                        {podcast.guest && <span className="truncate">{podcast.guest}</span>}
                        <span className="shrink-0">{podcast.duration}</span>
                      </div>
                      {podcast.description && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                          {podcast.description}
                        </p>
                      )}
                    </div>
                    {podcast.audioUrl && (
                      <div className="self-start shrink-0">
                        <button
                          onClick={() => setExpandedPodcastId(expandedPodcastId === podcast.id ? null : podcast.id)}
                          className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer"
                          aria-label={expandedPodcastId === podcast.id ? "Fechar player" : "Ouvir podcast"}
                        >
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary ml-0.5" />
                        </button>
                      </div>
                    )}
                    {!podcast.audioUrl && (
                      <div className="self-center shrink-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center opacity-40">
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                  {expandedPodcastId === podcast.id && podcast.audioUrl && (
                    <audio
                      controls
                      src={podcast.audioUrl}
                      className="w-full h-10"
                      autoPlay
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

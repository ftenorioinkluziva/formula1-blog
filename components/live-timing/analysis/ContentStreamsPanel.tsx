"use client"

import { useEffect, useRef, useState } from "react"
import { fetchLiveTiming } from "@/lib/live-timing/api"
import { parseSessionData } from "@/lib/live-timing/parsers"
import type { ContentStream } from "@/lib/live-timing/types"

const POLLING_MS = 15000

const TYPE_ICONS: Record<string, string> = {
  Commentary: "🎙",
  Video: "📺",
  Data: "📡",
  Radio: "📻",
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
}

type PlayerState = "idle" | "loading" | "playing" | "error"

function StreamCard({ stream }: { stream: ContentStream }) {
  const [state, setState] = useState<PlayerState>("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isAudio = stream.type === "Commentary" || stream.type === "Radio"
  const icon = TYPE_ICONS[stream.type] ?? "📡"
  const langLabel = LANG_LABELS[stream.language] ?? stream.language.toUpperCase()

  async function handlePlay() {
    if (state === "playing") {
      audioRef.current?.pause()
      setState("idle")
      return
    }

    const player = audioRef.current
    if (!player) {
      setState("error")
      return
    }

    setState("loading")
    try {
      await player.play()
      setState("playing")
    } catch {
      setState("error")
    }
  }

  function handleError() {
    setState("error")
  }

  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-semibold text-foreground capitalize">{stream.type}</span>
            <span className="text-xs text-muted-foreground/80 bg-secondary px-1.5 py-0.5 rounded">
              {langLabel}
            </span>
          </div>
          <div className="text-xs text-muted-foreground/80 truncate">{stream.name}</div>
        </div>

        {isAudio && (
          <button
            onClick={handlePlay}
            disabled={state === "loading" || state === "error"}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              state === "playing"
                ? "bg-red-600 hover:bg-red-700 text-foreground"
                : state === "error"
                ? "bg-secondary text-muted-foreground/60 cursor-not-allowed"
                : "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            }`}
          >
            {state === "loading" && <span className="animate-spin">⟳</span>}
            {state === "playing" ? "■ Parar" : state === "error" ? "Indisponível" : "▶ Ouvir"}
          </button>
        )}
      </div>

      {isAudio && (
        <audio
          ref={audioRef}
          src={stream.uri}
          preload="none"
          onError={handleError}
          onEnded={() => setState("idle")}
          className={`w-full mt-3 h-8 ${state === "playing" ? "block" : "hidden"}`}
          controls={state === "playing"}
          style={{ colorScheme: "dark" }}
        />
      )}

      {state === "error" && (
        <p className="mt-2 text-xs text-red-400/70">
          Stream indisponível — pode exigir autenticação F1 TV
        </p>
      )}

      {state === "playing" && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400">Ao vivo</span>
        </div>
      )}
    </div>
  )
}

export function ContentStreamsPanel() {
  const [streams, setStreams] = useState<ContentStream[]>([])
  const [audioStreams, setAudioStreams] = useState<ContentStream[]>([])
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const raw = await fetchLiveTiming()
        if (!raw) {
          setLoadError("Não foi possível consultar dados de live timing")
          setHasData(false)
          return
        }

        const parsed = parseSessionData(raw)
        const all = [...parsed.streams, ...parsed.audioStreams]
        setStreams(parsed.streams)
        setAudioStreams(parsed.audioStreams)
        setHasData(all.length > 0)
        setLoadError(null)
      } catch {
        setLoadError("Falha ao carregar streams")
        setHasData(false)
      }
    }
    load()
    const id = setInterval(load, POLLING_MS)
    return () => clearInterval(id)
  }, [])

  const allStreams = [...streams, ...audioStreams]

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Streams Disponíveis
        </h3>
        {allStreams.length > 0 && (
          <span className="text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            {allStreams.length} stream{allStreams.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground/60 mb-4">Fonte: ContentStreams · AudioStreams</p>

      {hasData === null && (
        <p className="text-sm text-muted-foreground/60">Carregando...</p>
      )}

      {hasData === false && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="text-2xl">📡</span>
          <p className="text-sm text-muted-foreground/80">
            {loadError ?? "Nenhum stream disponível nesta sessão"}
          </p>
          <p className="text-xs text-muted-foreground/50">ContentStreams e AudioStreams sem itens válidos</p>
        </div>
      )}

      {allStreams.length > 0 && (
        <div className="space-y-3">
          {allStreams.map((s, i) => (
            <StreamCard key={i} stream={s} />
          ))}
          <p className="text-xs text-muted-foreground/50 pt-1">
            * Streams de Commentary/Radio podem exigir autenticação F1 TV para reprodução
          </p>
        </div>
      )}
    </div>
  )
}

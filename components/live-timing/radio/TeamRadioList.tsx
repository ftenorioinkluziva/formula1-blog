"use client"

import { useLiveTiming } from "../LiveTimingProvider"
import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import type { TranscriptionResponse } from "@/lib/types/transcription"

interface TranscriptionCache {
  [key: string]: {
    text: string
    timestamp: number
  }
}

export function TeamRadioList() {
  const { radioCaptures, driverInfoMap, session } = useLiveTiming()
  const [transcriptions, setTranscriptions] = useState<TranscriptionCache>({})
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const locale = useLocale()

  const pageSize = 4
  const totalPages = Math.max(1, Math.ceil(radioCaptures.length / pageSize))
  const currentPage = Math.min(pageIndex, totalPages - 1)
  const startIndex = currentPage * pageSize
  const pagedCaptures = radioCaptures.slice(startIndex, startIndex + pageSize)

  useEffect(() => {
    if (pageIndex !== currentPage) {
      setPageIndex(currentPage)
    }
  }, [currentPage, pageIndex])

  async function transcribeAudio(audioUrl: string) {
    // Verificar cache
    if (transcriptions[audioUrl]) {
      return
    }

    if (loadingUrls.has(audioUrl)) {
      return
    }

    setLoadingUrls((prev) => new Set(prev).add(audioUrl))

    try {
      const response = await fetch(`/${locale}/api/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl }),
      })

      const data: TranscriptionResponse = await response.json()

      if (!response.ok) {
        return
      }

      if (data.success && data.text) {
        setTranscriptions((prev) => ({
          ...prev,
          [audioUrl]: {
            text: data.text!,
            timestamp: Date.now(),
          },
        }))
      }
    } catch {
      // Erro silencioso na transcrição
    } finally {
      setLoadingUrls((prev) => {
        const next = new Set(prev)
        next.delete(audioUrl)
        return next
      })
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-bold text-sm">Rádio da Equipe</h3>
        {radioCaptures.length > 0 && (
          <span className="text-xs text-muted-foreground/80">{radioCaptures.length} total</span>
        )}
      </div>
      <div className="space-y-3">
        {pagedCaptures.length === 0 ? (
          <div className="border border-yellow-600/30 rounded-lg p-3">
            <div className="text-yellow-600 text-sm mb-1">
              ⚠️ Sem dados de rádio
            </div>
            <div className="text-xs text-muted-foreground/80">
              Aguardando dados de rádio do SignalR para esta sessão.
            </div>
          </div>
        ) : (
          pagedCaptures.map((capture) => {
            const driverInfo = driverInfoMap[capture.racingNumber]
            const time = new Date(capture.utc).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
            const audioUrl = session?.path 
              ? `https://livetiming.formula1.com/static/${session.path}${capture.path}`
              : null
            const captureKey = `${capture.path}-${capture.utc}-${capture.racingNumber}`

            return (
              <div key={captureKey} className="border border-border rounded p-2">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-muted-foreground text-xs font-mono">{time}</span>
                  <span className="text-foreground text-sm font-bold">#{capture.racingNumber}</span>
                </div>
                {driverInfo && (
                  <div className="text-muted-foreground/80 text-xs mb-2">
                    {driverInfo.fullName} · {driverInfo.teamName}
                  </div>
                )}
                {audioUrl ? (
                  <div className="space-y-2">
                    <audio 
                      controls 
                      preload="none" 
                      className="w-full h-8" 
                      onError={() => undefined}
                      key={audioUrl ?? captureKey}
                      onPlay={() => {
                        // Transcrever automaticamente ao tocar
                        if (!transcriptions[audioUrl]) {
                          transcribeAudio(audioUrl)
                        }
                      }}
                    >
                      <source src={audioUrl} type="audio/mpeg" />
                    </audio>

                    {/* Botão para transcrever manualmente */}
                    {!transcriptions[audioUrl] && !loadingUrls.has(audioUrl) && (
                      <button
                        onClick={() => transcribeAudio(audioUrl)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-card/50 hover:bg-secondary/70 border border-border rounded transition-colors text-foreground/80"
                      >
                        <span>🎤</span>
                        <span>Transcrever</span>
                      </button>
                    )}

                    {/* Indicador de carregamento */}
                    {loadingUrls.has(audioUrl) && (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-500/10 border border-blue-500/30 rounded text-blue-300">
                        <span className="animate-spin">⏳</span>
                        <span>Transcrevendo...</span>
                      </div>
                    )}

                    {/* Transcrição */}
                    {transcriptions[audioUrl] && (
                      <div className="bg-background/50 border border-border rounded-lg p-3 max-h-40 overflow-y-auto">
                        <div className="text-muted-foreground text-xs mb-2 font-semibold">📝 Transcrição:</div>
                        <div className="text-foreground/80 text-sm leading-relaxed">
                          {transcriptions[audioUrl].text}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground p-2 bg-background/30 rounded">
                    ⚠️ URL do áudio indisponível (sessionPath ausente)
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      {radioCaptures.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <button
            className="px-2 py-1 rounded border border-border hover:bg-secondary disabled:opacity-40"
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            Anterior
          </button>
          <span>
            Página {currentPage + 1} de {totalPages}
          </span>
          <button
            className="px-2 py-1 rounded border border-border hover:bg-secondary disabled:opacity-40"
            onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}

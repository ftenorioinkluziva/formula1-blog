"use client"

import { useEffect, useState } from "react"
import { fetchLiveTiming } from "@/lib/live-timing/api"
import { parseChampionshipPrediction } from "@/lib/live-timing/parsers"
import type { ChampionshipPredictionEntry } from "@/lib/live-timing/types"

const POLLING_MS = 10000

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground/60 text-xs font-mono">±0</span>
  const color = delta > 0 ? "var(--status-success)" : "var(--status-danger)"
  const sign = delta > 0 ? "+" : ""
  return (
    <span className="text-xs font-mono font-bold" style={{ color }}>
      {sign}{delta}
    </span>
  )
}

export function ChampionshipPredictionCard() {
  const [entries, setEntries] = useState<ChampionshipPredictionEntry[]>([])
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    async function load() {
      const raw = await fetchLiveTiming()
      if (!raw) return

      if (raw.ChampionshipPrediction === null || raw.ChampionshipPrediction === undefined) {
        setNoData(true)
        return
      }

      const parsed = parseChampionshipPrediction(raw)
      if (parsed.length === 0) {
        setNoData(true)
      } else {
        setNoData(false)
        setEntries(parsed)
      }
    }
    load()
    const id = setInterval(load, POLLING_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Previsão de Campeonato
        </h3>
        {!noData && entries.length > 0 && (
          <span className="text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            Ao vivo
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground/60 mb-4">Fonte: ChampionshipPrediction</p>

      {noData || entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-muted-foreground/60 text-lg">🏆</span>
          </div>
          <p className="text-sm text-muted-foreground/80 text-center">
            Dados de previsão não disponíveis
          </p>
          <p className="text-xs text-muted-foreground/50 text-center">
            ChampionshipPrediction é fornecido pela F1 apenas durante corridas ao vivo
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground/80 font-medium pb-2 w-8">POS</th>
                <th className="text-left text-muted-foreground/80 font-medium pb-2 w-14">PIL</th>
                <th className="text-right text-muted-foreground/80 font-medium pb-2 px-3">Atual</th>
                <th className="text-right text-muted-foreground/80 font-medium pb-2 px-3">Previsto</th>
                <th className="text-right text-muted-foreground/80 font-medium pb-2 px-3">Delta</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.racingNumber} className="border-b border-border hover:bg-secondary">
                  <td className="py-2 text-muted-foreground/60">{idx + 1}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-0.5 h-4 rounded"
                        style={{ backgroundColor: `#${entry.teamColour}` }}
                      />
                      <span className="font-bold text-foreground">{entry.tla}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-muted-foreground font-mono">
                    {entry.currentPoints}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground font-mono font-semibold">
                    {entry.predictedPoints}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <DeltaBadge delta={entry.deltaPoints} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

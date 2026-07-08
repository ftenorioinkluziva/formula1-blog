"use client"

import { useState, useEffect } from "react"
import { useLocale } from "next-intl"
import { Loader2, Play, RefreshCw, TrendingUp, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function FantasyAdminPage() {
  const locale = useLocale()
  const [round, setRound] = useState(1)
  const [loading, setLoading] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adminSecret, setAdminSecret] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("f1blog_admin_secret") || ""
    setAdminSecret(saved)
  }, [])

  function handleSecretChange(val: string) {
    setAdminSecret(val)
    localStorage.setItem("f1blog_admin_secret", val)
  }

  function addLog(message: string) {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  async function handleAction(
    actionName: string,
    url: string,
    body: Record<string, unknown>
  ) {
    setLoading(actionName)
    setError(null)
    addLog(`Iniciando ação: ${actionName} para a Rodada ${body.round || round}...`)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || `A requisição falhou com status ${response.status}`)
      }

      addLog(`Sucesso: ${actionName} concluída!`)
      addLog(JSON.stringify(data, null, 2))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      setError(msg)
      addLog(`Erro: ${msg}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Fantasy Operations Console</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Painel administrativo para controle manual do ciclo de jogo, recálculo de scores, evolução de preços e pipeline pós-rodada.
          </p>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Auth protection */}
        <Card className="border-zinc-850 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle className="text-lg">Autenticação Administrativa</CardTitle>
            <CardDescription className="text-zinc-400">Insira a chave secreta de admin para habilitar as operações.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 max-w-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Chave Secreta (ADMIN_SECRET)</span>
              <input
                type="password"
                placeholder="Insira a chave..."
                value={adminSecret}
                onChange={(e) => handleSecretChange(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Global Controls */}
        <Card className="border-zinc-850 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle className="text-lg">Configurações da Etapa</CardTitle>
            <CardDescription className="text-zinc-400">Selecione a etapa para processamento das operações.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="space-y-1.5 flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Etapa (Round)</span>
                <select
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                  className="h-10 w-48 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Etapa {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Operations Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Score recalculation */}
          <Card className="border-zinc-850 bg-zinc-900 text-zinc-50 flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400 mb-2">
                <Trophy className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Recalcular Scores</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Calcula e persiste a pontuação de todas as entries travadas (locked) para a rodada selecionada.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() =>
                  void handleAction("Recalcular Scores", `/${locale}/api/fantasy/score`, {
                    season: 2026,
                    round,
                  })
                }
                disabled={loading !== null || !adminSecret.trim()}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-2"
              >
                {loading === "Recalcular Scores" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Calcular Rodada {round}
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Price Evolution */}
          <Card className="border-zinc-850 bg-zinc-900 text-zinc-50 flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-2">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Evolução de Preços</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Aplica a fórmula matemática de mercado baseada em performance e evolui os preços dos ativos para a próxima rodada.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() =>
                  void handleAction("Evolução de Preços", `/${locale}/api/fantasy/evolve-prices`, {
                    season: 2026,
                    fromRound: round,
                    toRound: round + 1,
                  })
                }
                disabled={loading !== null || !adminSecret.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2"
              >
                {loading === "Evolução de Preços" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Evoluir para Rodada {round + 1}
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Unified Post-Round Pipeline */}
          <Card className="border-zinc-850 bg-zinc-900 text-zinc-50 flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-2">
                <Play className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Pipeline Unificado</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Executa em sequência: sincronização de resultados oficiais, cálculo do score, OpenF1 e evolução de preços.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() =>
                  void handleAction("Pipeline Unificado", `/${locale}/api/fantasy/post-round`, {
                    season: 2026,
                    round,
                  })
                }
                disabled={loading !== null || !adminSecret.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2"
              >
                {loading === "Pipeline Unificado" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Executar Pipeline {round}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Terminal Logs Console */}
        <Card className="border-zinc-850 bg-zinc-950 text-zinc-200">
          <CardHeader className="border-b border-zinc-900 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase text-zinc-400">Terminal Log</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
                className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Limpar Console
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <strong>Erro crítico:</strong> {error}
              </div>
            )}
            <div className="h-72 overflow-y-auto rounded bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1">
              {logs.length === 0 ? (
                <div className="text-zinc-600 italic">Nenhuma ação disparada. Logs aparecerão aqui...</div>
              ) : (
                logs.map((log, idx) => (
                  <pre key={idx} className="whitespace-pre-wrap">
                    {log}
                  </pre>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

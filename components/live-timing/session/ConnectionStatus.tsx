"use client"

import { useLiveTiming } from "../LiveTimingProvider"

export function ConnectionStatus() {
  const { drivers, sessionState } = useLiveTiming()
  
  const isConnected = drivers.length > 0
  const hasSession = sessionState !== null

  if (isConnected) {
    return null
  }

  return (
    <div className="bg-orange-600/20 border border-orange-600/50 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="text-orange-500 text-2xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-orange-400 font-bold mb-1">Servidor de Live Timing não conectado</h3>
          <p className="text-foreground/80 text-sm mb-2">
            Não foi possível conectar ao F1 MultiViewer em <code className="text-orange-300 bg-background/30 px-1 rounded">localhost:10101</code>
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Para usar o Live Timing:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Baixe e instale o <strong className="text-foreground">F1 MultiViewer</strong></li>
              <li>Execute o MultiViewer durante uma sessão de F1</li>
              <li>Verifique se a API está em <code className="bg-background/30 px-1 rounded">http://localhost:10101/api/graphql</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

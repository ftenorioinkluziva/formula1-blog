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
          <h3 className="text-orange-400 font-bold mb-1">Live Timing não conectado</h3>
          <p className="text-foreground/80 text-sm mb-2">
            Não há snapshot recente do SignalR disponível para esta sessão.
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Para usar o Live Timing:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Confirme que existe uma sessão de F1 ao vivo ou prestes a começar</li>
              <li>Verifique se <code className="bg-background/30 px-1 rounded">AUTO_CONNECT_ENABLED=1</code> está configurado no servidor</li>
              <li>Consulte <code className="bg-background/30 px-1 rounded">/{`{locale}`}/api/f1tv/status</code> para o estado do SignalR</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

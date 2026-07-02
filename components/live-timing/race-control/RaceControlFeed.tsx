"use client"

import { useLiveTiming } from "../LiveTimingProvider"

const FLAG_COLORS: Record<string, string> = {
  RED: "text-red-500",
  YELLOW: "text-yellow-400",
  GREEN: "text-green-400",
  BLUE: "text-blue-400",
  CHEQUERED: "text-muted-foreground",
}

export function RaceControlFeed() {
  const { raceMessages } = useLiveTiming()

  const recentMessages = raceMessages.slice(0, 6)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-foreground font-bold mb-3 text-sm">Direção de Prova</h3>
      <div className="space-y-2">
        {recentMessages.length === 0 ? (
          <div className="text-muted-foreground/80 text-sm">Nenhuma mensagem</div>
        ) : (
          recentMessages.map((msg, idx) => {
            const flagColor = msg.flag ? FLAG_COLORS[msg.flag] || "text-muted-foreground" : "text-muted-foreground"
            const time = new Date(msg.utc).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })

            return (
              <div key={idx} className="border-l-2 border-border pl-3 py-1">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-muted-foreground/60 text-xs font-mono">{time}</span>
                  {msg.flag && (
                    <span className={`text-xs font-bold uppercase ${flagColor}`}>{msg.flag}</span>
                  )}
                </div>
                <div className="text-foreground/80 text-sm">{msg.message}</div>
                {(msg.sector || msg.racingNumber) && (
                  <div className="text-muted-foreground/60 text-xs mt-0.5">
                    {msg.sector && `Setor ${msg.sector}`}
                    {msg.sector && msg.racingNumber && " · "}
                    {msg.racingNumber && `#${msg.racingNumber}`}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

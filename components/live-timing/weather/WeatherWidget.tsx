"use client"

import { useLiveTiming } from "../LiveTimingProvider"

interface WeatherWidgetProps {
  compact?: boolean
}

export function WeatherWidget({ compact = false }: WeatherWidgetProps) {
  const { weather } = useLiveTiming()

  if (!weather) {
    return (
      <div className={`bg-card border border-border rounded-xl ${compact ? "p-3" : "p-4"}`}>
        <div className="text-muted-foreground/80 text-sm">No weather data</div>
      </div>
    )
  }

  const hasRain = Number(weather.rainfall) > 0
  const windDeg = Number(weather.windDirection) || 0

  return (
    <div className={`bg-card border border-border rounded-xl ${compact ? "p-3" : "p-4"}`}>
      <h3 className={`text-foreground font-bold mb-3 ${compact ? "text-sm" : "text-base"}`}>Clima</h3>
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Ar</div>
          <div className={`text-foreground font-bold ${compact ? "text-lg" : "text-xl"}`}>
            {weather.airTemp}°
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Pista</div>
          <div className={`text-foreground font-bold ${compact ? "text-lg" : "text-xl"}`}>
            {weather.trackTemp}°
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Umidade</div>
          <div className={`text-foreground font-bold ${compact ? "text-lg" : "text-xl"}`}>
            {weather.humidity}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Vento</div>
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 text-muted-foreground"
              style={{ transform: `rotate(${windDeg}deg)` }}
            >
              ↑
            </div>
            <div className={`text-foreground font-bold ${compact ? "text-sm" : "text-base"}`}>
              {weather.windSpeed} m/s
            </div>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Chuva</div>
          <div className={`font-bold ${hasRain ? "text-blue-400" : "text-muted-foreground/60"} ${compact ? "text-sm" : "text-base"}`}>
            {hasRain ? "Sim" : "Não"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground/80 text-xs uppercase mb-1">Pressão</div>
          <div className={`text-foreground font-bold ${compact ? "text-xs" : "text-sm"}`}>
            {weather.pressure} mb
          </div>
        </div>
      </div>
    </div>
  )
}

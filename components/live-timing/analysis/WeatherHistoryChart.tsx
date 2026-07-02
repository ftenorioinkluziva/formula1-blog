"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { fetchLiveTiming } from "@/lib/live-timing/api"
import { parseWeatherSeries } from "@/lib/live-timing/parsers"
import type { WeatherSeriesPoint } from "@/lib/live-timing/types"

const POLLING_MS = 10000

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function WeatherHistoryChart() {
  const [data, setData] = useState<WeatherSeriesPoint[]>([])

  useEffect(() => {
    async function load() {
      const raw = await fetchLiveTiming()
      if (!raw) return
      setData(parseWeatherSeries(raw))
    }
    load()
    const id = setInterval(load, POLLING_MS)
    return () => clearInterval(id)
  }, [])

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Histórico Climático
        </h3>
        <p className="text-sm text-muted-foreground/80">Sem dados de WeatherDataSeries disponíveis</p>
      </div>
    )
  }

  const chartData = data.map((p) => ({
    time: formatTime(p.timestamp),
    "Temp. Pista (°C)": p.trackTemp,
    "Temp. Ar (°C)": p.airTemp,
    "Umidade (%)": p.humidity,
    "Vento (m/s)": p.windSpeed,
  }))

  const lastPoint = data[data.length - 1]

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico Climático
        </h3>
        <span className="text-xs text-muted-foreground/60">{data.length} pontos</span>
      </div>
      <p className="text-xs text-muted-foreground/60 mb-4">Fonte: WeatherDataSeries</p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Pista", value: `${lastPoint.trackTemp}°C`, color: "var(--status-danger)" },
          { label: "Ar", value: `${lastPoint.airTemp}°C`, color: "var(--status-info)" },
          { label: "Umidade", value: `${lastPoint.humidity}%`, color: "var(--telemetry-throttle)" },
          { label: "Vento", value: `${lastPoint.windSpeed} m/s`, color: "var(--status-orange)" },
        ].map((item) => (
          <div key={item.label} className="bg-background rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground/80 mb-1">{item.label}</div>
            <div className="text-sm font-bold" style={{ color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
            itemStyle={{ fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)", paddingTop: 8 }} />
          <Line type="monotone" dataKey="Temp. Pista (°C)" stroke="var(--status-danger)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Temp. Ar (°C)" stroke="var(--status-info)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Umidade (%)" stroke="var(--telemetry-throttle)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="Vento (m/s)" stroke="var(--status-orange)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

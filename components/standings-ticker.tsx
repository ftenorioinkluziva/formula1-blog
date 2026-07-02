"use client"
import { useEffect, useState } from "react"
import { useLocale } from "next-intl"

interface DriverStandingItem {
  shortName: string
  points: number
  position: number
  teamColor: string
}

interface DriversApiResponse {
  drivers: DriverStandingItem[]
}

export function StandingsTicker() {
  const [standings, setStandings] = useState<DriverStandingItem[]>([])
  const locale = useLocale()

  useEffect(() => {
    async function loadStandings() {
      try {
        const response = await fetch(`/${locale}/api/drivers`, { cache: "no-store" })

        if (!response.ok) {
          setStandings([])
          return
        }

        const data = (await response.json()) as DriversApiResponse
        setStandings(data.drivers.slice(0, 8))
      } catch {
        setStandings([])
      }
    }

    loadStandings()
  }, [locale])

  if (standings.length === 0) {
    return null
  }

  return (
    <div className="bg-secondary border-y border-border overflow-hidden">
      <div className="flex animate-scroll">
        {[...standings, ...standings].map((driver, i) => (
          <div
            key={`${driver.shortName}-${i}`}
            className="flex items-center gap-3 px-6 py-3 shrink-0"
          >
            <span className="text-xs font-bold text-muted-foreground">
              P{driver.position}
            </span>
            <div
              className="w-1 h-4 rounded-full"
              style={{ backgroundColor: driver.teamColor }}
            />
            <span className="text-sm font-bold text-foreground tracking-wider">
              {driver.shortName}
            </span>
            <span className="text-xs text-muted-foreground">{driver.points} PTS</span>
          </div>
        ))}
      </div>
    </div>
  )
}

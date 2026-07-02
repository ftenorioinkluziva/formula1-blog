"use client"
import { useEffect, useMemo, useState } from "react"
import { MapPin, Calendar, Clock, ChevronRight } from "lucide-react"
import { RaceDetailModal } from "@/components/race-detail-modal"
import type { Race } from "@/components/race-detail-modal"
import { useLocale } from "next-intl"
import { formatLocalDate, formatLocalTime } from "@/lib/localized-date-time"

interface RaceApiSession {
  session: string
  startTimeUtc: string
}

interface RaceApiItem {
  round: number
  name: string
  circuit: string
  location: string
  raceStartUtc: string
  winner: string | null
  sessions: RaceApiSession[]
}

interface RaceWeekendsApiResponse {
  races: RaceApiItem[]
}

export function ScheduleSection() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [sourceRaces, setSourceRaces] = useState<RaceApiItem[]>([])
  const [now, setNow] = useState(() => new Date())
  const locale = useLocale()

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function loadRaces() {
      try {
        const response = await fetch(`/${locale}/api/race-weekends`, { cache: "no-store" })

        if (!response.ok) {
          setSourceRaces([])
          return
        }

        const data = (await response.json()) as RaceWeekendsApiResponse
        setSourceRaces(data.races)
      } catch {
        setSourceRaces([])
      }
    }

    loadRaces()
  }, [locale])

  const races: Race[] = useMemo(() => {
    const racesWithStart = sourceRaces.map((race) => ({
      race,
      startUtc: new Date(race.raceStartUtc),
    }))

    const nextRaceRound = racesWithStart.find((entry) => entry.startUtc >= now)?.race.round

    return racesWithStart.map(({ race, startUtc }) => ({
      round: race.round,
      name: race.name,
      circuit: race.circuit,
      location: race.location,
      raceStartUtc: race.raceStartUtc,
      sessions: race.sessions.map((session) => ({
        session: session.session,
        startTimeUtc: session.startTimeUtc,
      })),
      winner: race.winner ?? undefined,
      status: race.round === nextRaceRound ? "next" : startUtc < now ? "completed" : "upcoming",
    }))
  }, [sourceRaces, now])

  return (
    <section id="schedule" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/50" aria-labelledby="schedule-heading">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
              Race Calendar
            </span>
            <h2
              id="schedule-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
            >
              Schedule
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Full Calendar
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
        {/* Race list */}
        <div className="flex flex-col gap-2">
          {races.map((race) => {
            const raceDate = formatLocalDate(race.raceStartUtc, locale)
            const raceTime = formatLocalTime(race.raceStartUtc, locale)

            return (
            <article
              key={race.round}
              onClick={() => setSelectedRace(race)}
              className={`group flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-4 rounded-sm border transition-all cursor-pointer active:scale-[0.99] ${race.status === "next"
                ? "bg-primary/5 border-primary/30 hover:border-primary"
                : "bg-card border-border hover:border-foreground/20"
                }`}
            >
              {/* Main content row */}
              <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 lg:p-5 flex-1 min-w-0">
                {/* Round number */}
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase w-8 shrink-0">
                  R{String(race.round).padStart(2, "0")}
                </span>

                {/* Race name + location */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {race.name}
                    </h3>
                    {race.status === "next" && (
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm animate-pulse shrink-0">
                        Next
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{race.location}</span>
                    <span className="hidden sm:inline text-border mx-1">|</span>
                    <span className="hidden sm:inline truncate">{race.circuit}</span>
                  </div>
                </div>

                {/* Date + winner on the right (desktop) */}
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{raceDate}</div>
                    <div className="text-xs text-muted-foreground">{raceTime}</div>
                  </div>
                  {race.status === "completed" && race.winner && (
                    <div className="px-3 py-1.5 bg-secondary rounded-sm">
                      <span className="text-[10px] text-muted-foreground block">Winner</span>
                      <span className="text-sm font-black text-primary">{race.winner}</span>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Mobile bottom bar — date, time, winner, chevron */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-border/50 sm:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {raceDate}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {raceTime}
                  </div>
                  {race.status === "completed" && race.winner && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-xs font-black text-primary">{race.winner}</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </article>
            )
          })}
        </div>
      </div>
      <RaceDetailModal
        race={selectedRace}
        locale={locale}
        now={now}
        open={selectedRace !== null}
        onClose={() => setSelectedRace(null)}
      />
    </section>
  )
}
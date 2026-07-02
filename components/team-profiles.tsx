"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import { ChevronRight, Trophy, Users, TrendingUp } from "lucide-react"
import { TeamDetailModal } from "@/components/team-detail-modal"
import type { Team } from "@/components/team-detail-modal"
import { useLocale } from "next-intl"

interface TeamsApiResponse {
  teams: Team[]
}

const TEAM_CAR_IMAGE_BY_NAME: Record<string, string> = {
  McLaren: "2026mclarencarright.avif",
  Mercedes: "2026mercedescarright.avif",
  "Red Bull Racing": "2026redbullracingcarright.avif",
  Ferrari: "2026ferraricarright.avif",
  Williams: "2026williamscarright.avif",
  "Racing Bulls": "2026racingbullscarright.avif",
  "Aston Martin": "2026astonmartincarright.avif",
  "Haas F1 Team": "2026haascarright.avif",
  Audi: "2026audicarright.avif",
  Alpine: "2026alpinecarright.avif",
  Cadillac: "2026cadillaccarright.avif",
}

export function TeamProfiles() {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const locale = useLocale()

  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch(`/${locale}/api/teams`, { cache: "no-store" })

        if (!response.ok) {
          setTeams([])
          return
        }

        const data = (await response.json()) as TeamsApiResponse
        setTeams(data.teams)
      } catch {
        setTeams([])
      }
    }

    loadTeams()
  }, [locale])
  return (
    <section id="teams" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="teams-heading">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
              Constructor Standings
            </span>
            <h2
              id="teams-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
            >
              The Teams
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Full Standings
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {teams.map((team) => {
            const carImage = TEAM_CAR_IMAGE_BY_NAME[team.name]
              ? `/images/teams/${TEAM_CAR_IMAGE_BY_NAME[team.name]}`
              : "/placeholder.svg?height=200&width=360"

            return (
            <article
              key={team.name}
              className="group relative bg-card rounded-sm overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
              onClick={() => setSelectedTeam(team as Team)}
            >
              {/* Team color accent bar */}
              <div
                className="absolute top-0 left-0 w-full h-1 transition-all"
                style={{ backgroundColor: team.color }}
              />
              {/* Mobile: stacked layout. Desktop: horizontal layout */}
              <div className="flex flex-col sm:flex-row sm:items-stretch">
                {/* Car image area ajustada */}
                <div className="relative w-full sm:w-44 md:w-56 shrink-0 flex items-center justify-center overflow-hidden" style={{background: 'none', minHeight: '90px'}}>
                  <Image
                    src={carImage}
                    alt={`${team.name} car`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 176px, 224px"
                    className="object-contain object-left transition-all"
                  />
                  <div
                    className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{
                      background: `linear-gradient(135deg, ${team.color}40, transparent)`,
                    }}
                  />
                  {/* Position badge menor */}
                  <div className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 bg-background/80 backdrop-blur-sm rounded-sm">
                    <span className="text-xs font-black text-foreground">{team.position}</span>
                  </div>
                  {/* Mobile points overlay */}
                  <div className="absolute top-3 right-3 sm:hidden px-2.5 py-1 bg-background/80 backdrop-blur-sm rounded-sm">
                    <span className="text-base font-black" style={{ color: team.color }}>
                      {team.points}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">PTS</span>
                  </div>
                </div>
                {/* Team info */}
                <div className="flex-1 p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground mb-0.5 group-hover:text-primary transition-colors">
                          {team.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">{team.base}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {team.driver1}
                      </span>
                      <span className="text-border">|</span>
                      <span>{team.driver2}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-3 h-3 text-primary" />
                        <span className="text-[10px] sm:text-xs font-bold text-foreground">{team.wins}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">wins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] sm:text-xs font-bold text-foreground">{team.podiums}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">podiums</span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span
                        className="text-xl font-black"
                        style={{ color: team.color }}
                      >
                        {team.points}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">PTS</span>
                    </div>
                  </div>
                </div>
                {/* Hover arrow - desktop only */}
                <div className="hidden md:flex items-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </article>
            )
          })}
        </div>
      </div>
      <TeamDetailModal
        team={selectedTeam}
        open={selectedTeam !== null}
        onClose={() => setSelectedTeam(null)}
      />
    </section>
  )
}

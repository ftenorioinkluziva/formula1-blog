"use client"

import { useEffect, useState } from "react"
import { RacePaceChart } from "./race-pace-chart"
import { GapEvolutionChart } from "./gap-evolution-chart"
import { PitStrategyChart } from "./pit-strategy-chart"
import { QualifyingBreakdownChart } from "./qualifying-breakdown-chart"
import { ChampionshipProgressionChart } from "./championship-progression-chart"
import { TeammateH2HCard } from "./teammate-h2h-card"
import { ReliabilityTracker } from "./reliability-tracker"
import { PoleXRayChart } from "./pole-xray-chart"
import type { RaceWeekendOption } from "@/lib/analytics/types"

interface Props {
  locale: string
  initialRound?: number
}

const TABS = [
  { id: "qualifying", label: "Qualifying", perRound: true },
  { id: "pole", label: "Pole X-Ray", perRound: true },
  { id: "pace", label: "Race Pace", perRound: true },
  { id: "gap", label: "Gap to Leader", perRound: true },
  { id: "strategy", label: "Strategy", perRound: true },
  { id: "reliability", label: "Reliability", perRound: false },
  { id: "h2h", label: "Head-to-Head", perRound: false },
  { id: "championship", label: "Championship", perRound: false },
] as const

type TabId = typeof TABS[number]["id"]

const FIXED_SEASON = 2026

export function AnalyticsDashboard({ locale, initialRound }: Props) {
  const season = FIXED_SEASON
  const [round, setRound] = useState(initialRound ?? 1)
  const [weekends, setWeekends] = useState<RaceWeekendOption[]>([])
  const [activeTab, setActiveTab] = useState<TabId>("qualifying")
  const [loadingWeekends, setLoadingWeekends] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoadingWeekends(true)
      fetch(`/${locale}/api/analytics/race-weekends?season=${season}`)
        .then((r) => r.json())
        .then((data) => {
          const wk = data.weekends ?? []
          setWeekends(wk)
          const withResults = wk.filter((w: RaceWeekendOption) => w.hasResults)
          if (withResults.length > 0 && !initialRound) {
            setRound(withResults[withResults.length - 1].round)
          }
        })
        .catch(() => setWeekends([]))
        .finally(() => setLoadingWeekends(false))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [locale, initialRound, season])

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!
  const selectedWeekend = weekends.find((w) => w.round === round)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        {activeTabConfig.perRound && (
          <select
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
            disabled={loadingWeekends}
            className="bg-card border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:border-red-500 focus:outline-none disabled:opacity-50 flex-1 sm:flex-none sm:min-w-70"
          >
            {weekends.map((w) => (
              <option key={w.round} value={w.round} disabled={!w.hasResults}>
                R{w.round} — {w.grandPrixName} {w.hasResults ? "" : "(no data)"}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs sm:text-sm sm:px-4 sm:py-2 rounded-lg whitespace-nowrap transition-colors flex-none ${
                activeTab === tab.id
                  ? "bg-red-600 text-foreground font-medium"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground/90"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* fade hint on right edge */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-linear-to-l from-background to-transparent sm:hidden" aria-hidden="true" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {activeTabConfig.label}
          {activeTabConfig.perRound && selectedWeekend && (
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              — {selectedWeekend.grandPrixName}
            </span>
          )}
        </h2>
        <p className="text-xs text-muted-foreground/80 mb-4">{season} Season</p>

        {activeTab === "pace" && <RacePaceChart season={season} round={round} locale={locale} />}
        {activeTab === "gap" && <GapEvolutionChart season={season} round={round} locale={locale} />}
        {activeTab === "qualifying" && <QualifyingBreakdownChart season={season} round={round} locale={locale} />}
        {activeTab === "pole" && <PoleXRayChart season={season} round={round} locale={locale} />}
        {activeTab === "strategy" && <PitStrategyChart season={season} round={round} locale={locale} />}
        {activeTab === "championship" && <ChampionshipProgressionChart season={season} locale={locale} />}
        {activeTab === "h2h" && <TeammateH2HCard season={season} locale={locale} />}
        {activeTab === "reliability" && <ReliabilityTracker season={season} locale={locale} />}
      </div>
    </div>
  )
}

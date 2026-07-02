"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Crown, Medal, TimerReset, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getFantasyLeaderboard } from "@/lib/fantasy/client"
import type { FantasyLeaderboardResponse } from "@/lib/fantasy/types"
import type { RaceWeekendOption } from "@/lib/analytics/types"

interface Props {
  leaderboard: FantasyLeaderboardResponse | null
  weekends: RaceWeekendOption[]
  currentRound: number
  sessionKey: string
  locale: string
}

function rankTone(rank: number): string {
  if (rank === 1) return "text-amber-300"
  if (rank === 2) return "text-zinc-200"
  if (rank === 3) return "text-orange-300"
  return "text-zinc-400"
}

function selectEntriesAroundCurrent(
  entries: FantasyLeaderboardResponse["season"]["live"]["entries"],
): FantasyLeaderboardResponse["season"]["live"]["entries"] {
  const currentIndex = entries.findIndex((entry) => entry.isCurrentProfile)

  if (currentIndex === -1) {
    return entries.slice(0, 10)
  }

  const start = Math.max(0, currentIndex - 2)
  const end = Math.min(entries.length, currentIndex + 3)
  return entries.slice(start, end)
}

function LeaderboardList({
  title,
  subtitle,
  entries,
  emptyText,
  roundsLabel,
}: {
  title: string
  subtitle: string
  entries: FantasyLeaderboardResponse["season"]["live"]["entries"]
  emptyText: string
  roundsLabel: (count: number, avg: number) => string
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      {entries.length ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={`${title}-${entry.profileId}`} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 text-sm ${entry.isCurrentProfile ? "border-red-500/40 bg-red-500/10" : "border-zinc-800 bg-zinc-900/60"}`}>
              <div className={`font-semibold ${rankTone(entry.rank)}`}>#{entry.rank}</div>
              <div>
                <div className="font-medium text-zinc-100">{entry.displayName}</div>
                <div className="text-xs text-zinc-500">{roundsLabel(entry.roundsCount, entry.averageScore)}</div>
              </div>
              <div className="text-right font-semibold text-zinc-100">{entry.totalScore}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-800 py-5 text-center">
          <Users className="h-6 w-6 text-zinc-700" />
          <p className="text-sm text-zinc-500">{emptyText}</p>
        </div>
      )}
    </div>
  )
}

export function FantasyLeaderboardCard({ leaderboard, weekends, currentRound, sessionKey, locale }: Props) {
  const SEASON = 2026
  const t = useTranslations("fantasy.leaderboard")
  const [mode, setMode] = useState<"overall" | "round">("overall")
  const [viewMode, setViewMode] = useState<"top" | "around">("top")
  const [selectedRound, setSelectedRound] = useState(currentRound)
  const [roundLeaderboard, setRoundLeaderboard] = useState<FantasyLeaderboardResponse | null>(leaderboard)
  const [loadingRound, setLoadingRound] = useState(false)

  const scoredWeekends = useMemo(
    () => weekends.filter((w) => w.hasResults),
    [weekends],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoundLeaderboard(leaderboard)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [leaderboard])

  useEffect(() => {
    if (selectedRound === currentRound) {
      const timer = window.setTimeout(() => {
        setRoundLeaderboard(leaderboard)
      }, 0)

      return () => window.clearTimeout(timer)
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoadingRound(true)

      getFantasyLeaderboard(locale, SEASON, selectedRound, sessionKey)
        .then((data) => {
          if (!cancelled) setRoundLeaderboard(data)
        })
        .catch(() => {
          if (!cancelled) setRoundLeaderboard(null)
        })
        .finally(() => {
          if (!cancelled) setLoadingRound(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [selectedRound, currentRound, leaderboard, locale, sessionKey])

  const overallEntries = useMemo(() => {
    const entries = leaderboard?.season.official.entries ?? []
    return viewMode === "around" ? selectEntriesAroundCurrent(entries) : entries.slice(0, 10)
  }, [leaderboard, viewMode])

  const roundEntries = useMemo(() => {
    const entries = roundLeaderboard?.round?.entries ?? []
    return viewMode === "around" ? selectEntriesAroundCurrent(entries) : entries.slice(0, 10)
  }, [roundLeaderboard, viewMode])

  const overallLeader = leaderboard?.season.official.entries[0] ?? null
  const roundLeader = roundLeaderboard?.round?.entries[0] ?? null
  const roundIsOfficial = roundLeaderboard?.round?.isOfficial ?? false
  const roundName = roundLeaderboard?.round?.weekendName ?? t("currentRound")

  const overallCurrentEntry = leaderboard?.season.official.currentProfileEntry ?? null
  const roundCurrentEntry = roundLeaderboard?.round?.currentProfileEntry ?? null

  const viewLabel = viewMode === "around" ? t("aroundMe") : t("top10")
  const roundsLabel = (count: number, avg: number) => t("roundsCount", { count, avg })

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-50" data-testid="fantasy-leaderboard-card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-zinc-400">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 sm:p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em]">{t("roundLeader")}</span>
              <Medal className="hidden h-4 w-4 sm:block" />
            </div>
            <div className="mt-1.5 truncate text-xs font-semibold text-zinc-100 sm:mt-2 sm:text-sm">{roundLeader?.displayName ?? "-"}</div>
            <div className="text-[10px] text-zinc-500 sm:text-xs">{roundLeader ? `${roundLeader.totalScore} pts` : t("noScore")}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 sm:p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em]">{t("seasonLeader")}</span>
              <Crown className="hidden h-4 w-4 sm:block" />
            </div>
            <div className="mt-1.5 truncate text-xs font-semibold text-zinc-100 sm:mt-2 sm:text-sm">{overallLeader?.displayName ?? "-"}</div>
            <div className="text-[10px] text-zinc-500 sm:text-xs">{overallLeader ? `${overallLeader.totalScore} pts` : t("noScore")}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 sm:p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em]">{t("roundStatus")}</span>
              <TimerReset className="hidden h-4 w-4 sm:block" />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-zinc-100 sm:mt-2 sm:text-sm">{roundIsOfficial ? t("official") : t("provisional")}</div>
            <div className="text-[10px] text-zinc-500 sm:text-xs">{roundName}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as "overall" | "round")} variant="outline" size="sm" data-testid="fantasy-leaderboard-season-mode">
            <ToggleGroupItem value="overall" data-testid="fantasy-leaderboard-mode-overall">{t("overallRanking")}</ToggleGroupItem>
            <ToggleGroupItem value="round" data-testid="fantasy-leaderboard-mode-round">{t("roundRanking")}</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "top" | "around")} variant="outline" size="sm" data-testid="fantasy-leaderboard-view-mode">
            <ToggleGroupItem value="top" data-testid="fantasy-leaderboard-view-top">{t("top10")}</ToggleGroupItem>
            <ToggleGroupItem value="around" data-testid="fantasy-leaderboard-view-around">{t("aroundMe")}</ToggleGroupItem>
          </ToggleGroup>

          {mode === "round" && scoredWeekends.length > 0 && (
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
              data-testid="fantasy-leaderboard-round-selector"
            >
              {scoredWeekends.map((w) => (
                <option key={w.round} value={w.round}>
                  R{w.round} — {w.grandPrixName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === "round" && roundCurrentEntry ? (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-100">
              {t("yourRoundRank", { rank: roundCurrentEntry.rank })}
            </Badge>
          ) : null}
          {mode === "overall" && overallCurrentEntry ? (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              {t("yourSeasonRank", { rank: overallCurrentEntry.rank })}
            </Badge>
          ) : null}
        </div>

        {loadingRound ? (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-500">{t("loading")}</div>
        ) : mode === "overall" ? (
          <LeaderboardList
            title={t("overallRanking")}
            subtitle={`${t("allOfficialRounds")} · ${viewLabel}`}
            entries={overallEntries}
            emptyText={t("emptyRanking")}
            roundsLabel={roundsLabel}
          />
        ) : (
          <LeaderboardList
            title={`${t("roundRanking")} — ${roundName}`}
            subtitle={`${roundIsOfficial ? t("official") : t("provisional")} · ${viewLabel}`}
            entries={roundEntries}
            emptyText={t("emptyRanking")}
            roundsLabel={roundsLabel}
          />
        )}
      </CardContent>
    </Card>
  )
}

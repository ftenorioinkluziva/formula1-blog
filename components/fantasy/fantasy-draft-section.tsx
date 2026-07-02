"use client"

import { useTranslations } from "next-intl"
import { Loader2, Target, Trophy, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { DriverPickerShelf, TeamPickerShelf, EngineerPickerShelf } from "@/components/fantasy/fantasy-picker-shelf"
import { FantasyLineupSlots } from "@/components/fantasy/fantasy-lineup-slots"
import { FantasyLockCountdown } from "@/components/fantasy/fantasy-lock-countdown"
import { FantasyMetricCard } from "@/components/fantasy/fantasy-metric-card"
import { fantasyIssueLabel, formatFantasyCurrency, selectedFantasyAssetIdForSlot } from "@/components/fantasy/fantasy-ui-utils"
import type {
  FantasyAssetListItem,
  FantasyBootstrapResponse,
  FantasyPitWallLeadsResponse,
  FantasyReviewResponse,
  FantasyResultResponse,
  FantasySlotType,
} from "@/lib/fantasy/types"
import type { RaceWeekendOption } from "@/lib/analytics/types"

interface Props {
  round: number
  weekends: RaceWeekendOption[]
  displayName: string
  bootstrap: FantasyBootstrapResponse | null
  review: FantasyReviewResponse | null
  result: FantasyResultResponse | null
  driverAssets: FantasyAssetListItem[]
  teamAssets: FantasyAssetListItem[]
  pitWallLeads: FantasyPitWallLeadsResponse | null
  busy: string | null
  error: string | null
  scoreMessage: string | null
  onRoundChange: (round: number) => void
  onDisplayNameChange: (value: string) => void
  onSelect: (slot: FantasySlotType, assetId: number) => Promise<void>
  onLock: () => void
  onRecalculateScore: () => void
}

export function FantasyDraftSection({
  round,
  weekends,
  displayName,
  bootstrap,
  review,
  result,
  driverAssets,
  teamAssets,
  pitWallLeads,
  busy,
  error,
  scoreMessage,
  onRoundChange,
  onDisplayNameChange,
  onSelect,
  onLock,
  onRecalculateScore,
}: Props) {
  const t = useTranslations("fantasy.draft")
  const budgetPct = review ? Math.max(0, Math.min(100, (review.budget.spent / review.budget.total) * 100)) : 0
  const lockClosed = bootstrap?.lockStatus === "locked" || bootstrap?.lockStatus === "finished"

  const selectedDriver1Id = selectedFantasyAssetIdForSlot(review, "driver_1")
  const selectedDriver2Id = selectedFantasyAssetIdForSlot(review, "driver_2")
  const selectedTeamId = selectedFantasyAssetIdForSlot(review, "team")
  const selectedEngineerId = selectedFantasyAssetIdForSlot(review, "engineer")

  const driverImageMap: Record<number, string | null | undefined> = Object.fromEntries(
    driverAssets.map((a) => [a.assetId, a.imageUrl])
  )
  const teamImageMap: Record<number, string | null | undefined> = Object.fromEntries(
    teamAssets.map((a) => [a.assetId, a.imageUrl])
  )

  return (
    <>
      {/* Top control bar + lineup slots */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]" data-testid="fantasy-draft-section">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-50" data-testid="fantasy-overview-card">
          <CardContent className="space-y-4 px-4 pt-4 sm:space-y-5 sm:px-6 sm:pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{t("round")}</span>
                <select
                  value={round}
                  onChange={(event) => onRoundChange(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                  data-testid="fantasy-round-select"
                >
                  {weekends.map((weekend) => (
                    <option key={weekend.round} value={weekend.round}>
                      R{weekend.round} - {weekend.grandPrixName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{t("profileName")}</span>
                <Input
                  value={displayName}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  data-testid="fantasy-display-name-input"
                />
              </label>
            </div>

            <FantasyLineupSlots
              review={review}
              driverImageMap={driverImageMap}
              teamImageMap={teamImageMap}
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <FantasyLockCountdown lockStatus={bootstrap?.lockStatus} lockAt={bootstrap?.lockAt} />
              <FantasyMetricCard label="Budget" value={review ? `${formatFantasyCurrency(review.budget.spent)} / ${formatFantasyCurrency(review.budget.total)}` : "..."} icon={<Zap className="h-4 w-4" />} />
              <FantasyMetricCard label="Predictions" value={review?.predictions.isComplete ? "ready" : "pending"} icon={<Target className="h-4 w-4" />} />
              <FantasyMetricCard label="Score" value={result ? String(result.summary.totalScore) : "0"} icon={<Trophy className="h-4 w-4" />} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
                <span>{t("budgetUsage")}</span>
                <span>{review ? t("budgetLeft", { amount: formatFantasyCurrency(review.budget.remaining) }) : "..."}</span>
              </div>
              <Progress value={budgetPct} className="bg-zinc-800 **:data-[slot=progress-indicator]:bg-red-500" />
            </div>

            {error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" data-testid="fantasy-error-banner">{fantasyIssueLabel(error)}</p> : null}
            {scoreMessage ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" data-testid="fantasy-score-banner">{scoreMessage}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-[#111111] text-zinc-50" data-testid="fantasy-review-card">
          <CardHeader>
            <CardTitle>{t("review")}</CardTitle>
            <CardDescription className="text-zinc-400">{t("reviewDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <LineupSummary review={review} />
              <Separator className="mt-4 bg-zinc-800" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{t("issues")}</div>
              <div className="flex flex-wrap gap-2">
                {review?.eligibility.issues.length ? (
                  review.eligibility.issues.map((issue) => (
                    <Badge key={issue} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-100">
                      {fantasyIssueLabel(issue)}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">{t("readyToLock")}</Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Button className="w-full sm:w-auto" onClick={onLock} disabled={busy !== null || !review?.eligibility.isValid} data-testid="fantasy-lock-button">
                {busy === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("lockLineup")}
              </Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={onRecalculateScore} disabled={busy !== null || !lockClosed} data-testid="fantasy-score-button">
                {busy === "score" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("recalculateScore")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Compact horizontal picker shelves */}
      <section className="space-y-4">
        <PickerSection
          title="Drivers"
          description={t("driversDescription")}
          badge={
            (selectedDriver1Id ?? selectedDriver2Id) ? (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">
                {[selectedDriver1Id, selectedDriver2Id].filter(Boolean).length} / 2
              </Badge>
            ) : null
          }
        >
          <DriverPickerShelf
            items={driverAssets}
            busy={busy}
            selectedDriver1={selectedDriver1Id}
            selectedDriver2={selectedDriver2Id}
            budgetRemaining={review?.budget.remaining ?? Infinity}
            onSelect={onSelect}
          />
        </PickerSection>

        <PickerSection
          title="Teams"
          description={t("teamsDescription")}
          badge={
            selectedTeamId ? (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">1 / 1</Badge>
            ) : null
          }
        >
          <TeamPickerShelf
            items={teamAssets}
            busy={busy}
            selectedTeam={selectedTeamId}
            budgetRemaining={review?.budget.remaining ?? Infinity}
            onSelect={onSelect}
          />
        </PickerSection>

        <PickerSection
          title="Pit Wall Lead"
          description={t("pitWallDescription")}
          badge={
            selectedEngineerId ? (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">1 / 1</Badge>
            ) : null
          }
        >
          <EngineerPickerShelf
            items={pitWallLeads?.items ?? []}
            busy={busy}
            selectedEngineer={selectedEngineerId}
            budgetRemaining={review?.budget.remaining ?? Infinity}
            onSelect={onSelect}
          />
        </PickerSection>
      </section>
    </>
  )
}

function PickerSection({
  title,
  description,
  badge,
  children,
}: {
  title: string
  description: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-50">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs text-zinc-400">{description}</CardDescription>
          </div>
          {badge}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">{children}</CardContent>
    </Card>
  )
}

function LineupSummary({ review }: { review: FantasyReviewResponse | null }) {
  const items = [
    ["Driver 1", review?.lineup.driver1?.name ?? "-"],
    ["Team", review?.lineup.team?.name ?? "-"],
    ["Driver 2", review?.lineup.driver2?.name ?? "-"],
    ["Pit Wall Lead", review?.lineup.engineer?.name ?? "-"],
  ]

  return (
    <>
      <div className="hidden lg:block space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className="font-medium text-zinc-100">{value}</span>
          </div>
        ))}
      </div>
      <div className="lg:hidden grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-center">
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-zinc-100">{value}</div>
          </div>
        ))}
      </div>
    </>
  )
}

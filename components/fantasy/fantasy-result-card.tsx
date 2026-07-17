"use client"

import { useTranslations } from "next-intl"
import { BarChart3, Lock, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FantasyMetricCard } from "@/components/fantasy/fantasy-metric-card"
import type { FantasyResultResponse } from "@/lib/fantasy/types"

interface Props {
  result: FantasyResultResponse | null
  lockStatus: string | null
}

export function FantasyResultCard({ result, lockStatus }: Props) {
  const t = useTranslations("fantasy.result")

  const allItems = [
    ...(result?.blocks.drivers.items ?? []),
    ...(result?.blocks.team.items ?? []),
    ...(result?.blocks.engineer.items ?? []),
    ...(result?.blocks.predictions.items ?? []),
  ]

  let bestDecision: (typeof allItems)[0] | null = null
  let worstDecision: (typeof allItems)[0] | null = null

  if (allItems.length > 0) {
    const sorted = [...allItems].sort((a, b) => b.points - a.points)
    bestDecision = sorted[0]
    worstDecision = sorted[sorted.length - 1]
  }

  return (
    <Card className="border-border bg-surface-deep text-foreground" data-testid="fantasy-result-card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-zinc-400">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          <div className="grid grid-cols-3 gap-3">
            <FantasyMetricCard label={t("total")} value={String(result.summary.totalScore)} icon={<Trophy className="h-4 w-4 text-amber-400" />} />
            <FantasyMetricCard label={t("avgScore")} value={String(result.summary.avgRoundScore ?? 0)} icon={<BarChart3 className="h-4 w-4 text-blue-400" />} />
            <FantasyMetricCard
              label={t("difference")}
              value={`${result.summary.totalScore >= (result.summary.avgRoundScore ?? 0) ? "+" : ""}${
                result.summary.totalScore - (result.summary.avgRoundScore ?? 0)
              }`}
              icon={<Trophy className={`h-4 w-4 ${result.summary.totalScore >= (result.summary.avgRoundScore ?? 0) ? "text-emerald-400" : "text-red-400"}`} />}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FantasyMetricCard label={t("total")} value="0" icon={<Trophy className="h-4 w-4" />} />
            <FantasyMetricCard label={t("official")} value="no" icon={<Lock className="h-4 w-4" />} />
          </div>
        )}

        {result && allItems.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {bestDecision && bestDecision.points > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="font-semibold text-emerald-400">{t("bestDecision")}</div>
                <div className="mt-1 text-zinc-300 font-medium truncate">{bestDecision.label}</div>
                <div className="mt-0.5 text-emerald-400 font-bold">+{bestDecision.points} pts</div>
              </div>
            )}
            {worstDecision && worstDecision.points < 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="font-semibold text-red-400">{t("worstDecision")}</div>
                <div className="mt-1 text-zinc-300 font-medium truncate">{worstDecision.label}</div>
                <div className="mt-0.5 text-red-400 font-bold">{worstDecision.points} pts</div>
              </div>
            )}
          </div>
        )}

        <Separator className="bg-zinc-800" />
        <ResultBlock title={t("drivers")} blockKey="drivers" subtotal={result?.blocks.drivers.subtotal ?? 0} items={result?.blocks.drivers.items ?? []} emptyText={t("emptyBlock")} />
        <ResultBlock title={t("team")} blockKey="team" subtotal={result?.blocks.team.subtotal ?? 0} items={result?.blocks.team.items ?? []} emptyText={t("emptyBlock")} />
        <ResultBlock title={t("pitWall")} blockKey="pit wall" subtotal={result?.blocks.engineer.subtotal ?? 0} items={result?.blocks.engineer.items ?? []} emptyText={t("emptyBlock")} />
        <ResultBlock title="Predictions" blockKey="predictions" subtotal={result?.blocks.predictions.subtotal ?? 0} items={result?.blocks.predictions.items ?? []} emptyText={t("emptyBlock")} />
        {!result && lockStatus !== "locked" && lockStatus !== "finished" ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-800 py-6 text-center" data-testid="fantasy-result-empty">
            <BarChart3 className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">{t("emptyResult")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ResultBlock({ title, blockKey, subtotal, items, emptyText }: { title: string; blockKey: string; subtotal: number; items: Array<{ id: number; label: string; points: number }>; emptyText: string }) {
  return (
    <div className="space-y-2" data-testid={`fantasy-result-block-${blockKey}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200" data-testid={`fantasy-result-subtotal-${blockKey}`}>{subtotal}</Badge>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm" data-testid={`fantasy-result-item-${blockKey}-${item.id}`}>
              <span className="text-zinc-300">{item.label}</span>
              <span className={item.points >= 0 ? "text-emerald-300" : "text-red-300"}>{item.points}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500" data-testid={`fantasy-result-empty-${blockKey}`}>{emptyText}</p>
      )}
    </div>
  )
}

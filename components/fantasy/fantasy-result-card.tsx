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

  return (
    <Card className="border-zinc-800 bg-[#111111] text-zinc-50" data-testid="fantasy-result-card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-zinc-400">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FantasyMetricCard label={t("total")} value={String(result?.summary.totalScore ?? 0)} icon={<Trophy className="h-4 w-4" />} />
          <FantasyMetricCard label={t("official")} value={result?.summary.isOfficial ? "yes" : "no"} icon={<Lock className="h-4 w-4" />} />
        </div>
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

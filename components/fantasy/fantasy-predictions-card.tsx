"use client"

import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FantasyPredictionOptionsResponse, FantasyPredictionsInput } from "@/lib/fantasy/types"

interface Props {
  options: FantasyPredictionOptionsResponse | null
  predictions: FantasyPredictionsInput | null
  busy: string | null
  onChange: (predictions: FantasyPredictionsInput) => void
  onSave: () => void
}

export function FantasyPredictionsCard({ options, predictions, busy, onChange, onSave }: Props) {
  const t = useTranslations("fantasy.predictions")
  const driverOptions = options?.drivers ?? []
  const teamOptions = options?.teams ?? []
  const value = predictions ?? {
    poleDriverId: 0,
    raceWinnerDriverId: 0,
    podiumP2DriverId: 0,
    podiumP3DriverId: 0,
    fastestLapDriverId: 0,
    fastestPitTeamId: 0,
    safetyCarBand: "0",
    hasRedFlag: false,
  }

  function update<K extends keyof FantasyPredictionsInput>(key: K, nextValue: FantasyPredictionsInput[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-50" data-testid="fantasy-predictions-card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-zinc-400">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <PredictionSelect testId="fantasy-prediction-pole" label={t("pole")} placeholder={t("select")} value={value.poleDriverId} options={driverOptions.map((d) => ({ id: d.id, label: d.name }))} onChange={(next) => update("poleDriverId", next)} />
          <PredictionSelect testId="fantasy-prediction-race-winner" label={t("raceWinner")} placeholder={t("select")} value={value.raceWinnerDriverId} options={driverOptions.map((d) => ({ id: d.id, label: d.name }))} onChange={(next) => update("raceWinnerDriverId", next)} />
          <PredictionSelect testId="fantasy-prediction-podium-p2" label={t("podiumP2")} placeholder={t("select")} value={value.podiumP2DriverId} options={driverOptions.map((d) => ({ id: d.id, label: d.name }))} onChange={(next) => update("podiumP2DriverId", next)} />
          <PredictionSelect testId="fantasy-prediction-podium-p3" label={t("podiumP3")} placeholder={t("select")} value={value.podiumP3DriverId} options={driverOptions.map((d) => ({ id: d.id, label: d.name }))} onChange={(next) => update("podiumP3DriverId", next)} />
          <PredictionSelect testId="fantasy-prediction-fastest-lap" label={t("fastestLap")} placeholder={t("select")} value={value.fastestLapDriverId} options={driverOptions.map((d) => ({ id: d.id, label: d.name }))} onChange={(next) => update("fastestLapDriverId", next)} />
          <PredictionSelect testId="fantasy-prediction-fastest-pit-team" label={t("fastestPitTeam")} placeholder={t("select")} value={value.fastestPitTeamId} options={teamOptions.map((tp) => ({ id: tp.id, label: tp.name }))} onChange={(next) => update("fastestPitTeamId", next)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{t("safetyCarBand")}</span>
            <Select value={value.safetyCarBand} onValueChange={(v) => update("safetyCarBand", v)}>
              <SelectTrigger className="h-10 w-full border-zinc-800 bg-zinc-900 text-zinc-100" data-testid="fantasy-prediction-safety-car-band">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1-2">1-2</SelectItem>
                <SelectItem value="3+">3+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{t("redFlag")}</span>
            <Select value={value.hasRedFlag ? "yes" : "no"} onValueChange={(v) => update("hasRedFlag", v === "yes")}>
              <SelectTrigger className="h-10 w-full border-zinc-800 bg-zinc-900 text-zinc-100" data-testid="fantasy-prediction-red-flag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full sm:w-auto" onClick={onSave} disabled={busy !== null || options?.lockStatus === "locked" || options?.lockStatus === "finished"} data-testid="fantasy-save-predictions-button">
          {busy === "predictions" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </CardContent>
    </Card>
  )
}

function PredictionSelect({
  testId,
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  testId: string
  label: string
  placeholder: string
  value: number
  options: Array<{ id: number; label: string }>
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-10 w-full border-zinc-800 bg-zinc-900 text-zinc-100" data-testid={testId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

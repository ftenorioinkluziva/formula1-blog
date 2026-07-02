"use client"

import { useEffect, useState } from "react"
import {
  createFantasyDraft,
  getFantasyAssets,
  getFantasyBootstrap,
  getFantasyLeaderboard,
  getFantasyPitWallLeads,
  getFantasyPredictionOptions,
  getFantasyResult,
  getFantasyReview,
  lockFantasyDraft,
  removeFantasyLineupSlot,
  saveFantasyPredictions,
  triggerFantasyScore,
  updateFantasyLineup,
} from "@/lib/fantasy/client"
import { FantasyDraftSection } from "@/components/fantasy/fantasy-draft-section"
import { FantasyLeaderboardCard } from "@/components/fantasy/fantasy-leaderboard-card"
import { FantasyPredictionsCard } from "@/components/fantasy/fantasy-predictions-card"
import { FantasyResultCard } from "@/components/fantasy/fantasy-result-card"
import type {
  FantasyAssetListItem,
  FantasyBootstrapResponse,
  FantasyLeaderboardResponse,
  FantasyPitWallLeadsResponse,
  FantasyPredictionOptionsResponse,
  FantasyPredictionsInput,
  FantasyResultResponse,
  FantasyReviewResponse,
  FantasySlotType,
} from "@/lib/fantasy/types"
import type { RaceWeekendOption } from "@/lib/analytics/types"

interface Props {
  locale: string
  weekends: RaceWeekendOption[]
  initialRound: number
}

const SEASON = 2026
const SESSION_KEY_STORAGE = "fantasy-session-key"

function buildFallbackSessionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `fantasy-${crypto.randomUUID()}`
  }

  return `fantasy-${Date.now()}`
}

export function FantasyDashboard({ locale, weekends, initialRound }: Props) {
  const [round, setRound] = useState(initialRound)
  const [sessionKey, setSessionKey] = useState("")
  const [displayName, setDisplayName] = useState("Garage Owner")
  const [bootstrap, setBootstrap] = useState<FantasyBootstrapResponse | null>(null)
  const [review, setReview] = useState<FantasyReviewResponse | null>(null)
  const [predictionOptions, setPredictionOptions] = useState<FantasyPredictionOptionsResponse | null>(null)
  const [result, setResult] = useState<FantasyResultResponse | null>(null)
  const [leaderboard, setLeaderboard] = useState<FantasyLeaderboardResponse | null>(null)
  const [driverAssets, setDriverAssets] = useState<FantasyAssetListItem[]>([])
  const [teamAssets, setTeamAssets] = useState<FantasyAssetListItem[]>([])
  const [pitWallLeads, setPitWallLeads] = useState<FantasyPitWallLeadsResponse | null>(null)
  const [predictions, setPredictions] = useState<FantasyPredictionsInput | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scoreMessage, setScoreMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(SESSION_KEY_STORAGE) ?? buildFallbackSessionKey()
      window.localStorage.setItem(SESSION_KEY_STORAGE, saved)
      setSessionKey(saved)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!sessionKey) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      async function loadRound(): Promise<void> {
        setBusy("load")
        setError(null)
        setScoreMessage(null)

        try {
          const bootstrapResponse = await getFantasyBootstrap(locale, SEASON, round, sessionKey)
          if (cancelled) return
          setBootstrap(bootstrapResponse)

          const lockIsOpen = bootstrapResponse.lockStatus === "open" || bootstrapResponse.lockStatus === "closing_soon"

          if (!bootstrapResponse.hasExistingDraft && lockIsOpen) {
            await createFantasyDraft(locale, SEASON, round, sessionKey, displayName)
          }

          const hasEntry = bootstrapResponse.hasExistingDraft || lockIsOpen

          const [reviewResponse, driversResponse, teamsResponse, engineersResponse, predictionsResponse, resultResponse, leaderboardResponse] = await Promise.all([
            hasEntry ? getFantasyReview(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
            getFantasyAssets(locale, SEASON, round, "driver", sessionKey).catch(() => null),
            getFantasyAssets(locale, SEASON, round, "team", sessionKey).catch(() => null),
            hasEntry ? getFantasyPitWallLeads(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
            hasEntry ? getFantasyPredictionOptions(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
            hasEntry ? getFantasyResult(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
            getFantasyLeaderboard(locale, SEASON, round, sessionKey).catch(() => null),
          ])

          if (cancelled) return

          setReview(reviewResponse)
          setDriverAssets(driversResponse?.items ?? [])
          setTeamAssets(teamsResponse?.items ?? [])
          setPitWallLeads(engineersResponse)
          setPredictionOptions(predictionsResponse)
          setPredictions(predictionsResponse?.existingPredictions ?? null)
          setResult(resultResponse)
          setLeaderboard(leaderboardResponse)
        } catch (loadError) {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : "failed_to_load_fantasy")
          }
        } finally {
          if (!cancelled) {
            setBusy(null)
          }
        }
      }

      void loadRound()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [displayName, locale, round, sessionKey])

  async function refreshRound(): Promise<void> {
    if (!sessionKey) return

    const bootstrapResponse = await getFantasyBootstrap(locale, SEASON, round, sessionKey)
    const hasEntry = bootstrapResponse.hasExistingDraft || bootstrapResponse.lockStatus === "open" || bootstrapResponse.lockStatus === "closing_soon"

    const [reviewResponse, driversResponse, teamsResponse, engineersResponse, predictionsResponse, resultResponse, leaderboardResponse] = await Promise.all([
      hasEntry ? getFantasyReview(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
      getFantasyAssets(locale, SEASON, round, "driver", sessionKey).catch(() => null),
      getFantasyAssets(locale, SEASON, round, "team", sessionKey).catch(() => null),
      hasEntry ? getFantasyPitWallLeads(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
      hasEntry ? getFantasyPredictionOptions(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
      hasEntry ? getFantasyResult(locale, SEASON, round, sessionKey).catch(() => null) : Promise.resolve(null),
      getFantasyLeaderboard(locale, SEASON, round, sessionKey).catch(() => null),
    ])

    setBootstrap(bootstrapResponse)
    setReview(reviewResponse)
    setDriverAssets(driversResponse?.items ?? [])
    setTeamAssets(teamsResponse?.items ?? [])
    setPitWallLeads(engineersResponse)
    setPredictionOptions(predictionsResponse)
    setPredictions(predictionsResponse?.existingPredictions ?? null)
    setResult(resultResponse)
    setLeaderboard(leaderboardResponse)
  }

  async function handleSelect(slot: FantasySlotType, assetId: number): Promise<void> {
    if (!sessionKey) return

    const lineup = review?.lineup
    const isDeselect =
      (slot === "driver_1" && lineup?.driver1?.assetId === assetId) ||
      (slot === "driver_2" && lineup?.driver2?.assetId === assetId) ||
      (slot === "team" && lineup?.team?.assetId === assetId) ||
      (slot === "engineer" && lineup?.engineer?.assetId === assetId)

    setBusy(slot)
    setError(null)

    try {
      if (isDeselect) {
        await removeFantasyLineupSlot(locale, SEASON, round, sessionKey, slot)
      } else {
        await updateFantasyLineup(locale, SEASON, round, sessionKey, slot, assetId)
      }
      await refreshRound()
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "failed_to_update_lineup")
    } finally {
      setBusy(null)
    }
  }

  async function handleSavePredictions(): Promise<void> {
    if (!sessionKey || !predictions) return

    setBusy("predictions")
    setError(null)

    try {
      await saveFantasyPredictions(locale, SEASON, round, sessionKey, predictions)
      await refreshRound()
    } catch (predictionError) {
      setError(predictionError instanceof Error ? predictionError.message : "failed_to_save_predictions")
    } finally {
      setBusy(null)
    }
  }

  async function handleLock(): Promise<void> {
    if (!sessionKey) return

    setBusy("lock")
    setError(null)

    try {
      await lockFantasyDraft(locale, SEASON, round, sessionKey)
      await refreshRound()
    } catch (lockError) {
      setError(lockError instanceof Error ? lockError.message : "failed_to_lock_entry")
    } finally {
      setBusy(null)
    }
  }

  async function handleRecalculateScore(): Promise<void> {
    if (!sessionKey) return

    setBusy("score")
    setError(null)
    setScoreMessage(null)

    try {
      const scoreResponse = await triggerFantasyScore(locale, SEASON, round, sessionKey)
      setScoreMessage(`Entries recalculadas: ${scoreResponse.entriesScored}`)
      await refreshRound()
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : "failed_to_score_round")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6" data-testid="fantasy-dashboard" data-round={round} data-session-key={sessionKey || undefined}>
      <FantasyDraftSection
        round={round}
        weekends={weekends}
        displayName={displayName}
        bootstrap={bootstrap}
        review={review}
        result={result}
        driverAssets={driverAssets}
        teamAssets={teamAssets}
        pitWallLeads={pitWallLeads}
        busy={busy}
        error={error}
        scoreMessage={scoreMessage}
        onRoundChange={setRound}
        onDisplayNameChange={setDisplayName}
        onSelect={handleSelect}
        onLock={() => void handleLock()}
        onRecalculateScore={() => void handleRecalculateScore()}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <FantasyPredictionsCard
          options={predictionOptions}
          predictions={predictions}
          busy={busy}
          onChange={setPredictions}
          onSave={() => void handleSavePredictions()}
        />
        <FantasyResultCard result={result} lockStatus={bootstrap?.lockStatus ?? null} />
      </section>

      <FantasyLeaderboardCard leaderboard={leaderboard} weekends={weekends} currentRound={round} sessionKey={sessionKey} locale={locale} />
    </div>
  )
}

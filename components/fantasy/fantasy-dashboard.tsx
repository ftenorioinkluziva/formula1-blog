"use client"

import { useEffect, useState, useRef } from "react"
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
  updateFantasyLineup,
  updateFantasyProfile,
} from "@/lib/fantasy/client"
import { FantasyDraftSection } from "@/components/fantasy/fantasy-draft-section"
import { FantasyGameplayStepper } from "@/components/fantasy/fantasy-gameplay-stepper"
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
  initialDisplayName?: string
}

const SEASON = 2026

export function FantasyDashboard({ locale, weekends, initialRound, initialDisplayName }: Props) {
  const [round, setRound] = useState(initialRound)
  const [displayName, setDisplayName] = useState(initialDisplayName || "Garage Owner")
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

  const displayNameRef = useRef(displayName)
  useEffect(() => {
    displayNameRef.current = displayName
  }, [displayName])

  useEffect(() => {
    if (bootstrap?.profile?.displayName) {
      setDisplayName(bootstrap.profile.displayName)
    }
  }, [bootstrap?.profile?.displayName])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      async function loadRound(): Promise<void> {
        setBusy("load")
        setError(null)
        setScoreMessage(null)

        try {
          const bootstrapResponse = await getFantasyBootstrap(locale, SEASON, round)
          if (cancelled) return
          setBootstrap(bootstrapResponse)

          let currentBootstrap = bootstrapResponse
          const lockIsOpen = bootstrapResponse.lockStatus === "open" || bootstrapResponse.lockStatus === "closing_soon"

          if (!bootstrapResponse.hasExistingDraft && lockIsOpen) {
            const draftResult = await createFantasyDraft(locale, SEASON, round, displayNameRef.current)
            if (draftResult?.profile) {
              currentBootstrap = {
                ...bootstrapResponse,
                profile: draftResult.profile,
                hasExistingDraft: true,
                draftStatus: draftResult.draftStatus ?? draftResult.entry.status,
              }
              setBootstrap(currentBootstrap)
            }
          }

          const hasEntry = currentBootstrap.hasExistingDraft || lockIsOpen

          const [reviewResponse, driversResponse, teamsResponse, engineersResponse, predictionsResponse, resultResponse, leaderboardResponse] = await Promise.all([
            hasEntry ? getFantasyReview(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
            getFantasyAssets(locale, SEASON, round, "driver").catch(() => null),
            getFantasyAssets(locale, SEASON, round, "team").catch(() => null),
            hasEntry ? getFantasyPitWallLeads(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
            hasEntry ? getFantasyPredictionOptions(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
            hasEntry ? getFantasyResult(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
            getFantasyLeaderboard(locale, SEASON, round).catch(() => null),
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
  }, [locale, round])

  async function refreshRound(): Promise<void> {
    const bootstrapResponse = await getFantasyBootstrap(locale, SEASON, round)
    const hasEntry = bootstrapResponse.hasExistingDraft || bootstrapResponse.lockStatus === "open" || bootstrapResponse.lockStatus === "closing_soon"

    const [reviewResponse, driversResponse, teamsResponse, engineersResponse, predictionsResponse, resultResponse, leaderboardResponse] = await Promise.all([
      hasEntry ? getFantasyReview(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
      getFantasyAssets(locale, SEASON, round, "driver").catch(() => null),
      getFantasyAssets(locale, SEASON, round, "team").catch(() => null),
      hasEntry ? getFantasyPitWallLeads(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
      hasEntry ? getFantasyPredictionOptions(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
      hasEntry ? getFantasyResult(locale, SEASON, round).catch(() => null) : Promise.resolve(null),
      getFantasyLeaderboard(locale, SEASON, round).catch(() => null),
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
        await removeFantasyLineupSlot(locale, SEASON, round, slot)
      } else {
        await updateFantasyLineup(locale, SEASON, round, slot, assetId)
      }
      await refreshRound()
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "failed_to_update_lineup")
    } finally {
      setBusy(null)
    }
  }

  async function handleSavePredictions(): Promise<void> {
    if (!predictions) return

    setBusy("predictions")
    setError(null)

    try {
      await saveFantasyPredictions(locale, SEASON, round, predictions)
      await refreshRound()
    } catch (predictionError) {
      setError(predictionError instanceof Error ? predictionError.message : "failed_to_save_predictions")
    } finally {
      setBusy(null)
    }
  }

  async function handleLock(): Promise<void> {
    setBusy("lock")
    setError(null)

    try {
      await lockFantasyDraft(locale, SEASON, round)
      await refreshRound()
    } catch (lockError) {
      setError(lockError instanceof Error ? lockError.message : "failed_to_lock_entry")
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveDisplayName(newName: string): Promise<void> {
    if (!newName.trim()) return
    try {
      await updateFantasyProfile(locale, newName.trim())
    } catch (saveError) {
      console.error("Failed to persist display name:", saveError)
    }
  }

  return (
    <div className="space-y-6" data-testid="fantasy-dashboard" data-round={round}>
      <FantasyGameplayStepper bootstrap={bootstrap} review={review} />

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
        onDisplayNameSave={handleSaveDisplayName}
        onSelect={handleSelect}
        onLock={() => void handleLock()}
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

      <FantasyLeaderboardCard leaderboard={leaderboard} weekends={weekends} currentRound={round} locale={locale} />
    </div>
  )
}

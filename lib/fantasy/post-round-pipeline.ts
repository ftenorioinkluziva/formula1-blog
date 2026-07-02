import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceSessions, raceWeekends } from "@/lib/db/schema"
import {
  fetchAllLaps,
  fetchConstructorStandings,
  fetchDriverStandings,
  fetchPitStops,
  fetchQualifyingResults,
  fetchRaceResults,
  fetchSeasonSchedule,
  fetchSprintResults,
} from "@/lib/jolpica/client"
import { resolveExternalRound } from "@/lib/jolpica/round-mapping"
import {
  syncCircuits,
  syncConstructorStandings,
  syncDriverStandings,
  syncDriverStatsFromResults,
  syncLapSummaries,
  syncPitStops as syncPitStopsDb,
  syncPodiumsFromResults,
  syncQualifyingResultsToSession,
  syncRaceResultsToSession,
  syncSprintResultsToSession,
} from "@/lib/db/standings"
import {
  fetchCarData,
  fetchIntervals,
  fetchLaps,
  fetchRaceControl,
  findQualifyingSessionKey,
  findSession,
  fetchStints,
  fetchTeamRadio,
  fetchWeather,
} from "@/lib/openf1/client"
import {
  enrichLapSummariesWithOpenF1,
  syncPoleTelemetry,
  syncRaceControlFromOpenF1,
  syncRaceIntervals,
  syncSessionWeather,
  syncTeamRadio,
  syncTireStints,
} from "@/lib/db/openf1-sync"
import { scoreFantasyRound } from "@/lib/db/fantasy-scoring"
import { evolveFantasyPrices } from "@/lib/db/fantasy-pricing"

export interface StepResult {
  step: string
  status: "ok" | "skipped" | "warning" | "error"
  detail?: string
}

export interface RunFantasyPostRoundOptions {
  season: number
  round: number
  requireRaceResults?: boolean
  includeScoring?: boolean
  evolvePrices?: boolean
}

export interface RunFantasyPostRoundResult {
  season: number
  round: number
  nextRound: number
  steps: StepResult[]
}

export async function runFantasyPostRound(
  options: RunFantasyPostRoundOptions,
): Promise<RunFantasyPostRoundResult> {
  const {
    season,
    round,
    requireRaceResults = true,
    includeScoring = true,
    evolvePrices = true,
  } = options

  const steps: StepResult[] = []
  const roundResolution = await resolveExternalRound(season, round)
  const externalRound = roundResolution.externalRound

  if (roundResolution.shifted) {
    steps.push({
      step: "resolve_external_round",
      status: "ok",
      detail: `local round ${round} (${roundResolution.localGrandPrixName}) -> Jolpica round ${externalRound} (${roundResolution.externalRaceName})`,
    })
  }

  const driverStandings = await fetchDriverStandings(season)
  const driverResult = await syncDriverStandings(driverStandings)
  steps.push({ step: "sync_driver_standings", status: "ok", detail: `${driverResult.updated} updated` })

  const constructorStandings = await fetchConstructorStandings(season)
  const teamResult = await syncConstructorStandings(constructorStandings)
  steps.push({ step: "sync_constructor_standings", status: "ok", detail: `${teamResult.updated} updated` })

  const schedule = await fetchSeasonSchedule(season)
  const circuitResult = await syncCircuits(schedule)
  steps.push({
    step: "sync_circuits",
    status: "ok",
    detail: `${circuitResult.circuitsUpserted} circuits, ${circuitResult.weekendsLinked} linked`,
  })

  const race = await fetchRaceResults(season, externalRound)

  if (race) {
    await syncPodiumsFromResults(race.Results)
    const sessionResult = await syncRaceResultsToSession(race.Results, season, round)
    steps.push({ step: "sync_race_results", status: "ok", detail: `${sessionResult.inserted} drivers` })

    await syncDriverStatsFromResults(race.Results)
  } else if (requireRaceResults) {
    steps.push({
      step: "sync_race_results",
      status: "error",
      detail: "no race results from Jolpica — scoring may be incomplete",
    })
  } else {
    steps.push({ step: "sync_race_results", status: "skipped", detail: "race not finalised yet" })
  }

  const quali = await fetchQualifyingResults(season, externalRound)
  if (quali) {
    const qualiResult = await syncQualifyingResultsToSession(quali.QualifyingResults, season, round)
    steps.push({ step: "sync_qualifying_results", status: "ok", detail: `${qualiResult.inserted} drivers` })
  } else {
    steps.push({ step: "sync_qualifying_results", status: "skipped", detail: "no data" })
  }

  const sprintResults = await fetchSprintResults(season, externalRound)
  if (sprintResults) {
    const sprintResult = await syncSprintResultsToSession(sprintResults, season, round)
    steps.push({ step: "sync_sprint_results", status: "ok", detail: `${sprintResult.inserted} drivers` })
  } else {
    steps.push({ step: "sync_sprint_results", status: "skipped", detail: "not a sprint weekend" })
  }

  if (race) {
    const driverIdToCode = new Map(
      race.Results.map((result) => [result.Driver.driverId, result.Driver.code]),
    )

    const laps = await fetchAllLaps(season, externalRound)
    if (laps.length > 0) {
      const lapResult = await syncLapSummaries(laps, season, round, driverIdToCode)
      steps.push({ step: "sync_laps", status: "ok", detail: `${lapResult.inserted} entries` })
    } else {
      steps.push({ step: "sync_laps", status: "skipped", detail: "no data" })
    }

    const pitStopsData = await fetchPitStops(season, externalRound)
    if (pitStopsData.length > 0) {
      const pitResult = await syncPitStopsDb(pitStopsData, season, round, driverIdToCode)
      steps.push({ step: "sync_pit_stops", status: "ok", detail: `${pitResult.inserted} entries` })
    } else {
      steps.push({ step: "sync_pit_stops", status: "skipped", detail: "no data" })
    }
  } else {
    steps.push({ step: "sync_laps", status: "skipped", detail: "race not finalised yet" })
    steps.push({ step: "sync_pit_stops", status: "skipped", detail: "race not finalised yet" })
  }

  try {
    const db = getDb()
    let weekendInfo: { country: string; circuit: string } | null = null
    let raceStartTimeUtc: Date | null = null
    let qualifyingStartTimeUtc: Date | null = null

    if (db) {
      const weekend = await db
        .select({ country: raceWeekends.country, circuit: raceWeekends.circuit })
        .from(raceWeekends)
        .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
        .limit(1)

      weekendInfo = weekend[0] ?? null

      raceStartTimeUtc = (
        await db
          .select({ startTimeUtc: raceSessions.startTimeUtc })
          .from(raceSessions)
          .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
          .where(
            and(
              eq(raceWeekends.season, season),
              eq(raceWeekends.round, round),
              eq(raceSessions.sessionCode, "R"),
            ),
          )
          .limit(1)
      )[0]?.startTimeUtc ?? null

      qualifyingStartTimeUtc = (
        await db
          .select({ startTimeUtc: raceSessions.startTimeUtc })
          .from(raceSessions)
          .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
          .where(
            and(
              eq(raceWeekends.season, season),
              eq(raceWeekends.round, round),
              eq(raceSessions.sessionCode, "Q"),
            ),
          )
          .limit(1)
      )[0]?.startTimeUtc ?? null
    }

    if (weekendInfo && race) {
      const raceSession = await findSession({
        year: season,
        sessionName: "Race",
        countryName: weekendInfo.country,
        circuitName: weekendInfo.circuit,
        startTimeUtc: raceStartTimeUtc ?? undefined,
      })
      const openF1SessionKey = raceSession?.session_key ?? null

      if (openF1SessionKey) {
        const [openF1Stints, openF1Laps, openF1Weather] = await Promise.all([
          fetchStints(openF1SessionKey),
          fetchLaps(openF1SessionKey),
          fetchWeather(openF1SessionKey),
        ])

        if (openF1Stints.length > 0) {
          try {
            await syncTireStints(openF1Stints, season, round, "R")
          } catch {
            // non-critical
          }
        }

        if (openF1Laps.length > 0 && openF1Stints.length > 0) {
          try {
            await enrichLapSummariesWithOpenF1(openF1Laps, openF1Stints, season, round, "R")
          } catch {
            // non-critical
          }
        }

        if (openF1Weather.length > 0) {
          try {
            await syncSessionWeather(openF1Weather, season, round, "R")
          } catch {
            // non-critical
          }
        }

        try {
          const openF1Intervals = await fetchIntervals(openF1SessionKey)
          if (openF1Intervals.length > 0 && openF1Laps.length > 0) {
            await syncRaceIntervals(openF1Intervals, openF1Laps, season, round, "R")
          }
        } catch {
          // non-critical
        }

        try {
          const openF1RaceControl = await fetchRaceControl(openF1SessionKey)
          if (openF1RaceControl.length > 0) {
            await syncRaceControlFromOpenF1(openF1RaceControl, season, round, "R")
          }
        } catch {
          // non-critical
        }

        try {
          const openF1TeamRadioData = await fetchTeamRadio(openF1SessionKey)
          const openF1LapsForRadio = await fetchLaps(openF1SessionKey)
          if (openF1TeamRadioData.length > 0 && openF1LapsForRadio.length > 0) {
            await syncTeamRadio(openF1TeamRadioData, openF1LapsForRadio, season, round, "R")
          }
        } catch {
          // non-critical
        }

        steps.push({ step: "openf1_enrichment", status: "ok" })
      } else {
        steps.push({ step: "openf1_enrichment", status: "skipped", detail: "no matching session" })
      }

      if (weekendInfo) {
        try {
          const qualiSessionKey = await findQualifyingSessionKey(
            season,
            weekendInfo.country,
            weekendInfo.circuit,
            qualifyingStartTimeUtc ?? undefined,
          )
          if (qualiSessionKey) {
            const qualiLaps = await fetchLaps(qualiSessionKey)
            const poleLaps = [...qualiLaps].filter((l) => l.lap_duration !== null)
            if (poleLaps.length > 0) {
              poleLaps.sort((a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity))
              const poleDriverNumber = poleLaps[0].driver_number
              const poleCarData = await fetchCarData(qualiSessionKey, poleDriverNumber)
              if (poleCarData.length > 0) {
                const telResult = await syncPoleTelemetry(poleCarData, qualiLaps, poleDriverNumber, season, round, "Q")
                steps.push({ step: "sync_pole_telemetry", status: "ok", detail: `${telResult.inserted} samples` })
              } else {
                steps.push({ step: "sync_pole_telemetry", status: "skipped", detail: "no car data for pole driver" })
              }
            } else {
              steps.push({ step: "sync_pole_telemetry", status: "skipped", detail: "no qualifying laps with duration" })
            }
          } else {
            steps.push({ step: "sync_pole_telemetry", status: "skipped", detail: "no qualifying session on OpenF1" })
          }
        } catch (err) {
          steps.push({
            step: "sync_pole_telemetry",
            status: "warning",
            detail: err instanceof Error ? err.message : "failed",
          })
        }
      }
    } else {
      steps.push({ step: "openf1_enrichment", status: "skipped", detail: race ? "no weekend info found" : "race not finalised yet" })
    }
  } catch (err) {
    steps.push({
      step: "openf1_enrichment",
      status: "warning",
      detail: err instanceof Error ? err.message : "failed",
    })
  }

  if (includeScoring) {
    const scoringResult = await scoreFantasyRound(season, round)

    if (scoringResult) {
      steps.push({ step: "score_entries", status: "ok", detail: `${scoringResult.entriesScored} entries scored` })
    } else {
      steps.push({ step: "score_entries", status: "skipped", detail: "no locked entries or missing data" })
    }
  } else {
    steps.push({ step: "score_entries", status: "skipped", detail: "disabled for this automation run" })
  }

  if (evolvePrices) {
    const priceResult = await evolveFantasyPrices(season, round, round + 1)

    if (priceResult) {
      const moved = priceResult.updatedAssets.filter((asset) => asset.delta !== 0).length
      steps.push({
        step: "evolve_prices",
        status: "ok",
        detail: `${priceResult.updatedAssets.length} assets processed, ${moved} prices changed`,
      })
    } else {
      steps.push({ step: "evolve_prices", status: "skipped", detail: "no assets found" })
    }
  } else {
    steps.push({ step: "evolve_prices", status: "skipped", detail: "disabled for this automation run" })
  }

  if (race) {
    try {
      const { generatePodcastForRace } = await import("@/lib/podcast/pipeline")
      const podcast = await generatePodcastForRace({ season, round })
      steps.push({ step: "generate_podcast", status: "ok", detail: `${podcast.title} (#${podcast.podcastId})` })
    } catch (err) {
      steps.push({
        step: "generate_podcast",
        status: "warning",
        detail: err instanceof Error ? err.message : "failed",
      })
    }
  } else {
    steps.push({ step: "generate_podcast", status: "skipped", detail: "race not finalised yet" })
  }

  return {
    season,
    round,
    nextRound: round + 1,
    steps,
  }
}

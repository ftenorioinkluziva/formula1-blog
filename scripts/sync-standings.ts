import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { fetchDriverStandings, fetchConstructorStandings, fetchRaceResults, fetchQualifyingResults, fetchSprintResults, fetchAllLaps, fetchPitStops, fetchSeasonSchedule } from "../lib/jolpica/client"
import { syncDriverStandings, syncConstructorStandings, syncPodiumsFromResults, syncRaceResultsToSession, syncDriverStatsFromResults, syncQualifyingResultsToSession, syncSprintResultsToSession, syncLapSummaries, syncPitStops, syncCircuits } from "../lib/db/standings"
import { findSession, fetchStints, fetchLaps, fetchWeather, fetchRaceControl, fetchIntervals, fetchCarData, findQualifyingSessionKey, fetchTeamRadio } from "../lib/openf1/client"
import { syncTireStints, enrichLapSummariesWithOpenF1, syncSessionWeather, syncRaceControlFromOpenF1, syncRaceIntervals, syncPoleTelemetry, syncTeamRadio } from "../lib/db/openf1-sync"
import { scoreFantasyRound } from "../lib/db/fantasy-scoring"
import { evolveFantasyPrices } from "../lib/db/fantasy-pricing"
import { eq, and } from "drizzle-orm"
import { getDb } from "../lib/db/client"
import { raceSessions, raceWeekends } from "../lib/db/schema"
import { resolveExternalRound } from "../lib/jolpica/round-mapping"
import { generatePodcastForRace } from "../lib/podcast/pipeline"

const season = parseInt(process.argv[2] ?? "2026", 10)
const roundArg = process.argv[3] ? parseInt(process.argv[3], 10) : null

async function main() {
  console.log(`\n🏁 Syncing standings for ${season} season...\n`)

  // 1. Sync driver standings
  console.log("📊 Fetching driver standings from Jolpica-F1...")
  const driverStandings = await fetchDriverStandings(season)
  console.log(`   Found ${driverStandings.length} drivers`)

  const driverResult = await syncDriverStandings(driverStandings)
  console.log(`   ✅ Updated: ${driverResult.updated} drivers`)

  if (driverResult.skipped.length > 0) {
    console.log(`   ⚠️  Skipped: ${driverResult.skipped.join(", ")}`)
  }

  // 2. Sync constructor standings
  console.log("\n📊 Fetching constructor standings from Jolpica-F1...")
  const constructorStandings = await fetchConstructorStandings(season)
  console.log(`   Found ${constructorStandings.length} constructors`)

  const teamResult = await syncConstructorStandings(constructorStandings)
  console.log(`   ✅ Updated: ${teamResult.updated} teams`)

  if (teamResult.skipped.length > 0) {
    console.log(`   ⚠️  Skipped: ${teamResult.skipped.join(", ")}`)
  }

  // 3. Sync circuits from season schedule
  console.log(`\n🏟️  Syncing circuits from ${season} schedule...`)
  const schedule = await fetchSeasonSchedule(season)
  const circuitResult = await syncCircuits(schedule)
  console.log(`   ✅ Circuits: ${circuitResult.circuitsUpserted} upserted, ${circuitResult.weekendsLinked} weekends linked`)

  // 4. Optionally sync podiums from a specific round's results
  let raceFinalised = false

  if (roundArg) {
    const roundResolution = await resolveExternalRound(season, roundArg)
    const externalRound = roundResolution.externalRound

    if (roundResolution.shifted) {
      console.log(
        `\n🔁 Local round ${roundArg} (${roundResolution.localGrandPrixName}) mapped to Jolpica round ${externalRound} (${roundResolution.externalRaceName})`,
      )
    }

    console.log(`\n🏆 Fetching race results for round ${externalRound}...`)
    const race = await fetchRaceResults(season, externalRound)

    if (race) {
      raceFinalised = true
      console.log(`   Race: ${race.raceName}`)
      const podiumResult = await syncPodiumsFromResults(race.Results)
      console.log(`   ✅ Podium increments applied to ${podiumResult.driversUpdated} drivers`)

      const sessionResult = await syncRaceResultsToSession(race.Results, season, roundArg)
      console.log(`   ✅ Session results: ${sessionResult.inserted} drivers inserted`)

      if (sessionResult.skipped.length > 0) {
        console.log(`   ⚠️  Skipped: ${sessionResult.skipped.join(", ")}`)
      }

      const statsResult = await syncDriverStatsFromResults(race.Results)
      console.log(`   ✅ Driver stats (GP entered, DNFs, poles, best finish/grid): ${statsResult.updated} drivers`)

      const winner = race.Results[0]
      if (winner) {
        console.log(`   🥇 Winner: ${winner.Driver.givenName} ${winner.Driver.familyName}`)
      }
    } else {
      console.log("   ⚠️  No results found for this round")
    }

    // 4. Sync qualifying results
    console.log(`\n🏎️  Fetching qualifying results for round ${externalRound}...`)
    const quali = await fetchQualifyingResults(season, externalRound)

    if (quali) {
      const qualiResult = await syncQualifyingResultsToSession(quali.QualifyingResults, season, roundArg)
      console.log(`   ✅ Qualifying results: ${qualiResult.inserted} drivers inserted`)

      if (qualiResult.skipped.length > 0) {
        console.log(`   ⚠️  Skipped: ${qualiResult.skipped.join(", ")}`)
      }
    } else {
      console.log("   ⚠️  No qualifying results found for this round")
    }

    // 5. Sync sprint results
    console.log(`\n🏃 Fetching sprint results for round ${externalRound}...`)
    const sprintResults = await fetchSprintResults(season, externalRound)

    if (sprintResults) {
      const sprintResult = await syncSprintResultsToSession(sprintResults, season, roundArg)
      console.log(`   ✅ Sprint results: ${sprintResult.inserted} drivers inserted`)

      if (sprintResult.skipped.length > 0) {
        console.log(`   ⚠️  Skipped: ${sprintResult.skipped.join(", ")}`)
      }
    } else {
      console.log("   ⚠️  No sprint results (not a sprint weekend)")
    }

    // 6. Sync lap-by-lap timings
    console.log(`\n⏱️  Fetching lap timings for round ${externalRound}...`)
    const laps = await fetchAllLaps(season, externalRound)

    if (laps.length > 0 && race) {
      const driverIdToCode = new Map(
        race.Results.map((r) => [r.Driver.driverId, r.Driver.code])
      )
      const lapResult = await syncLapSummaries(laps, season, roundArg, driverIdToCode)
      console.log(`   ✅ Lap summaries: ${lapResult.inserted} entries across ${laps.length} laps`)

      if (lapResult.skipped.length > 0) {
        console.log(`   ⚠️  Skipped drivers: ${lapResult.skipped.join(", ")}`)
      }
    } else {
      console.log("   ⚠️  No lap timing data available")
    }

    // 7. Sync pit stops
    console.log(`\n🔧 Fetching pit stops for round ${externalRound}...`)
    const pitStopsData = await fetchPitStops(season, externalRound)

    if (pitStopsData.length > 0 && race) {
      const driverIdToCodeForPits = new Map(
        race.Results.map((r) => [r.Driver.driverId, r.Driver.code])
      )
      const pitResult = await syncPitStops(pitStopsData, season, roundArg, driverIdToCodeForPits)
      console.log(`   ✅ Pit stops: ${pitResult.inserted} entries`)

      if (pitResult.skipped.length > 0) {
        console.log(`   ⚠️  Skipped drivers: ${pitResult.skipped.join(", ")}`)
      }
    } else {
      console.log("   ⚠️  No pit stop data available")
    }

    // 8. Sync OpenF1 data (stints, enriched laps, weather)
    console.log(`\n🔄 Fetching OpenF1 data (stints, lap enrichment, weather)...`)
    try {
      const db = getDb()
      let weekendInfo: { country: string; circuit: string } | null = null
      let raceStartTimeUtc: Date | null = null
      let qualifyingStartTimeUtc: Date | null = null
      if (db) {
        const weekend = await db
          .select({ country: raceWeekends.country, circuit: raceWeekends.circuit })
          .from(raceWeekends)
          .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, roundArg)))
          .limit(1)

        weekendInfo = weekend[0] ?? null

        const sessionRows = await db
          .select({ sessionCode: raceSessions.sessionCode, startTimeUtc: raceSessions.startTimeUtc })
          .from(raceSessions)
          .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
          .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, roundArg)))

        raceStartTimeUtc = sessionRows.find((session) => session.sessionCode === "R")?.startTimeUtc ?? null
        qualifyingStartTimeUtc = sessionRows.find((session) => session.sessionCode === "Q")?.startTimeUtc ?? null
      }

      let openF1SessionKey: number | null = null

      if (weekendInfo) {
        const raceSession = await findSession({
          year: season,
          sessionName: "Race",
          countryName: weekendInfo.country,
          circuitName: weekendInfo.circuit,
          startTimeUtc: raceStartTimeUtc ?? undefined,
        })
        openF1SessionKey = raceSession?.session_key ?? null
      }

      if (openF1SessionKey) {
        console.log(`   Found OpenF1 session key: ${openF1SessionKey}`)

        const [openF1Stints, openF1Laps, openF1Weather] = await Promise.all([
          fetchStints(openF1SessionKey),
          fetchLaps(openF1SessionKey),
          fetchWeather(openF1SessionKey),
        ])

        try {
          if (openF1Stints.length > 0) {
            const stintResult = await syncTireStints(openF1Stints, season, roundArg, "R")
            console.log(`   ✅ Tire stints: ${stintResult.inserted} synced`)
            if (stintResult.skipped.length > 0) {
              console.log(`   ⚠️  Skipped: ${stintResult.skipped.join(", ")}`)
            }
          } else {
            console.log("   ⚠️  No stint data from OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Tire stints sync failed: ${err instanceof Error ? err.message : err}`)
        }

        try {
          if (openF1Laps.length > 0 && openF1Stints.length > 0) {
            const enrichResult = await enrichLapSummariesWithOpenF1(openF1Laps, openF1Stints, season, roundArg, "R")
            console.log(`   ✅ Lap enrichment (speed traps + compounds): ${enrichResult.updated} laps updated`)
          }
        } catch (err) {
          console.log(`   ⚠️  Lap enrichment failed: ${err instanceof Error ? err.message : err}`)
        }

        try {
          if (openF1Weather.length > 0) {
            const weatherResult = await syncSessionWeather(openF1Weather, season, roundArg, "R")
            console.log(`   ✅ Weather data: ${weatherResult.inserted} samples stored`)
          } else {
            console.log("   ⚠️  No weather data from OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Weather sync failed: ${err instanceof Error ? err.message : err}`)
        }

        try {
          const openF1Intervals = await fetchIntervals(openF1SessionKey)
          if (openF1Intervals.length > 0 && openF1Laps.length > 0) {
            const ivResult = await syncRaceIntervals(openF1Intervals, openF1Laps, season, roundArg, "R")
            console.log(`   ✅ Race intervals: ${ivResult.inserted} synced`)
            if (ivResult.skipped.length > 0) {
              console.log(`   ⚠️  Skipped: ${ivResult.skipped.join(", ")}`)
            }
          } else {
            console.log("   ⚠️  No interval data from OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Intervals sync failed: ${err instanceof Error ? err.message : err}`)
        }

        try {
          const openF1RaceControl = await fetchRaceControl(openF1SessionKey)
          if (openF1RaceControl.length > 0) {
            const rcResult = await syncRaceControlFromOpenF1(openF1RaceControl, season, roundArg, "R")
            console.log(`   ✅ Race control messages: ${rcResult.inserted} synced`)
          } else {
            console.log("   ⚠️  No race control data from OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Race control sync failed: ${err instanceof Error ? err.message : err}`)
        }

        try {
          const openF1TeamRadio = await fetchTeamRadio(openF1SessionKey)
          if (openF1TeamRadio.length > 0 && openF1Laps.length > 0) {
            const radioResult = await syncTeamRadio(openF1TeamRadio, openF1Laps, season, roundArg, "R")
            console.log(`   ✅ Team radio: ${radioResult.inserted} synced`)
            if (radioResult.skipped.length > 0) {
              console.log(`   ⚠️  Skipped: ${radioResult.skipped.join(", ")}`)
            }
          } else {
            console.log("   ⚠️  No team radio data from OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Team radio sync failed: ${err instanceof Error ? err.message : err}`)
        }
      } else {
        console.log("   ⚠️  Could not find matching OpenF1 session (data available from 2023+)")
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
            console.log(`\n🔬 Syncing pole telemetry (OpenF1 qualifying session: ${qualiSessionKey})...`)
            const qualiLaps = await fetchLaps(qualiSessionKey)
            const poleLaps = [...qualiLaps].filter((l) => l.lap_duration !== null)
            if (poleLaps.length > 0) {
              poleLaps.sort((a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity))
              const poleDriverNumber = poleLaps[0].driver_number
              const poleCarData = await fetchCarData(qualiSessionKey, poleDriverNumber)
              if (poleCarData.length > 0) {
                const telResult = await syncPoleTelemetry(poleCarData, qualiLaps, poleDriverNumber, season, roundArg, "Q")
                console.log(`   ✅ Pole telemetry: ${telResult.inserted} samples synced`)
                if (telResult.skipped.length > 0) {
                  console.log(`   ⚠️  Skipped: ${telResult.skipped.join(", ")}`)
                }
              } else {
                console.log("   ⚠️  No car data for pole driver")
              }
            } else {
              console.log("   ⚠️  No qualifying laps with duration")
            }
          } else {
            console.log("   ⚠️  No qualifying session found on OpenF1")
          }
        } catch (err) {
          console.log(`   ⚠️  Pole telemetry sync failed: ${err instanceof Error ? err.message : err}`)
        }
      }
    } catch (err) {
      console.log(`   ⚠️  OpenF1 sync failed (non-critical): ${err instanceof Error ? err.message : err}`)
    }
  }

  // 9. Score fantasy round
  if (roundArg) {
    console.log(`\n🎮 Scoring fantasy round ${roundArg}...`)
    try {
      const scoreResult = await scoreFantasyRound(season, roundArg)
      if (scoreResult) {
        console.log(`   ✅ Fantasy scored: ${scoreResult.entriesScored} entries`)
      } else {
        console.log("   ⚠️  Fantasy scoring skipped (no context or no locked entries)")
      }
    } catch (err) {
      console.log(`   ⚠️  Fantasy scoring failed: ${err instanceof Error ? err.message : err}`)
    }

    // 10. Evolve prices for next round
    const nextRound = roundArg + 1
    console.log(`\n💰 Evolving asset prices from round ${roundArg} → ${nextRound}...`)
    try {
      const priceResult = await evolveFantasyPrices(season, roundArg, nextRound)
      console.log(`   ✅ Prices evolved: ${priceResult?.updatedAssets.length ?? 0} assets updated`)
    } catch (err) {
      console.log(`   ⚠️  Price evolution failed: ${err instanceof Error ? err.message : err}`)
    }

    if (raceFinalised) {
      console.log(`\n🎙️  Generating podcast for round ${roundArg}...`)
      try {
        const podcast = await generatePodcastForRace({ season, round: roundArg })
        console.log(`   ✅ Podcast generated: ${podcast.title}`)
        console.log(`   🎧 ${podcast.audioUrl}`)
      } catch (err) {
        console.log(`   ⚠️  Podcast generation failed: ${err instanceof Error ? err.message : err}`)
      }
    } else {
      console.log("\n🎙️  Podcast generation skipped (race not finalised yet)")
    }
  }

  console.log("\n✅ Standings sync complete!\n")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n❌ Standings sync failed:", err)
  process.exit(1)
})

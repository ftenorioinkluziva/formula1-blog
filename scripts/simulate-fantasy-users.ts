import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "../lib/db/client"
import { getFantasyContext, getCurrentAssetPricesMap } from "../lib/db/fantasy-core"
import { scoreFantasyRound } from "../lib/db/fantasy-scoring"
import {
  drivers,
  fantasyAssetPrices,
  fantasyAssets,
  fantasyEngineers,
  fantasyPredictions,
  fantasyProfiles,
  fantasyRoundEntries,
  fantasyRoundHoldings,
  fantasyRoundScores,
  teams,
} from "../lib/db/schema"

const season = parseInt(process.argv[2] ?? "2026", 10)
const round = parseInt(process.argv[3] ?? "1", 10)
const userCount = parseInt(process.argv[4] ?? "10", 10)

const SIM_USERS = Array.from({ length: userCount }, (_, index) => ({
  displayName: `Sim Owner ${String(index + 1).padStart(2, "0")}`,
  sessionKey: `fantasy-sim-${String(index + 1).padStart(2, "0")}`,
}))

type DriverAsset = {
  assetId: number
  entityId: number
  name: string
  teamId: number
  price: number
  position: number
}

type TeamAsset = {
  assetId: number
  entityId: number
  name: string
  price: number
  position: number
}

type PitWallAsset = {
  assetId: number
  entityId: number
  name: string
  teamId: number
  price: number
  position: number
}

type CandidateLineup = {
  drivers: [DriverAsset, DriverAsset]
  team: TeamAsset
  pitWall: PitWallAsset
  totalCost: number
}

function uniqueByAsset<T extends { assetId: number }>(items: T[]): T[] {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.assetId)) {
      return false
    }

    seen.add(item.assetId)
    return true
  })
}

function buildLockedAt(lockAtIso: string | null): Date {
  if (!lockAtIso) {
    return new Date("2026-03-01T12:00:00.000Z")
  }

  return new Date(new Date(lockAtIso).getTime() - 2 * 60 * 60 * 1000)
}

function chooseCandidateLineups(
  budgetCap: number,
  driverPool: DriverAsset[],
  teamPool: TeamAsset[],
  pitWallPool: PitWallAsset[],
  count: number,
): CandidateLineup[] {
  const candidates: CandidateLineup[] = []

  for (let left = 0; left < driverPool.length; left += 1) {
    for (let right = left + 1; right < driverPool.length; right += 1) {
      const driverOne = driverPool[left]
      const driverTwo = driverPool[right]

      for (const team of teamPool) {
        for (const pitWall of pitWallPool) {
          const totalCost = Number((driverOne.price + driverTwo.price + team.price + pitWall.price).toFixed(1))

          if (totalCost > budgetCap) {
            continue
          }

          candidates.push({
            drivers: [driverOne, driverTwo],
            team,
            pitWall,
            totalCost,
          })
        }
      }
    }
  }

  const sorted = candidates.sort((left, right) => {
    if (left.totalCost !== right.totalCost) {
      return right.totalCost - left.totalCost
    }

    const leftStrength = left.drivers[0].position + left.drivers[1].position + left.team.position + left.pitWall.position
    const rightStrength = right.drivers[0].position + right.drivers[1].position + right.team.position + right.pitWall.position
    return leftStrength - rightStrength
  })

  const chosen: CandidateLineup[] = []
  const signatures = new Set<string>()

  for (const candidate of sorted) {
    const signature = [
      candidate.drivers[0].assetId,
      candidate.drivers[1].assetId,
      candidate.team.assetId,
      candidate.pitWall.assetId,
    ].join(":")

    if (signatures.has(signature)) {
      continue
    }

    signatures.add(signature)
    chosen.push(candidate)

    if (chosen.length === count) {
      break
    }
  }

  return chosen
}

async function main() {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    throw new Error("Fantasy context not found")
  }

  const lockedAt = buildLockedAt(context.lockAt)

  const [driverRows, teamRows, pitWallRows] = await Promise.all([
    db
      .select({
        assetId: fantasyAssets.id,
        entityId: drivers.id,
        name: drivers.fullName,
        teamId: teams.id,
        position: drivers.position,
      })
      .from(fantasyAssets)
      .innerJoin(drivers, eq(fantasyAssets.sourceDriverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "driver"), eq(fantasyAssets.isActive, true)))
      .orderBy(asc(drivers.position), asc(drivers.fullName)),
    db
      .select({
        assetId: fantasyAssets.id,
        entityId: teams.id,
        name: teams.name,
        position: teams.position,
      })
      .from(fantasyAssets)
      .innerJoin(teams, eq(fantasyAssets.sourceTeamId, teams.id))
      .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "team"), eq(fantasyAssets.isActive, true)))
      .orderBy(asc(teams.position), asc(teams.name)),
    db
      .select({
        assetId: fantasyAssets.id,
        entityId: fantasyEngineers.id,
        name: fantasyEngineers.displayName,
        teamId: teams.id,
        position: teams.position,
      })
      .from(fantasyAssets)
      .innerJoin(fantasyEngineers, eq(fantasyAssets.sourceEngineerId, fantasyEngineers.id))
      .innerJoin(teams, eq(fantasyEngineers.teamId, teams.id))
      .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "engineer"), eq(fantasyAssets.isActive, true), eq(fantasyEngineers.isActive, true)))
      .orderBy(asc(teams.position), asc(fantasyEngineers.displayName)),
  ])

  const allAssetIds = [
    ...driverRows.map((row) => row.assetId),
    ...teamRows.map((row) => row.assetId),
    ...pitWallRows.map((row) => row.assetId),
  ]
  const priceMap = await getCurrentAssetPricesMap(season, round, allAssetIds)

  const driversWithPrices = uniqueByAsset(
    driverRows.map((row) => ({
      ...row,
      price: priceMap.get(row.assetId)?.price ?? 0,
    })),
  )
  const teamsWithPrices = uniqueByAsset(
    teamRows.map((row) => ({
      ...row,
      price: priceMap.get(row.assetId)?.price ?? 0,
    })),
  )
  const pitWallsWithPrices = uniqueByAsset(
    pitWallRows.map((row) => ({
      ...row,
      price: priceMap.get(row.assetId)?.price ?? 0,
    })),
  )

  const lineups = chooseCandidateLineups(
    context.budgetCap,
    driversWithPrices.slice(0, Math.min(12, driversWithPrices.length)),
    teamsWithPrices.slice(0, Math.min(6, teamsWithPrices.length)),
    pitWallsWithPrices.slice(0, Math.min(8, pitWallsWithPrices.length)),
    SIM_USERS.length,
  )

  if (lineups.length < SIM_USERS.length) {
    throw new Error(`Could not assemble ${SIM_USERS.length} valid lineups within budget ${context.budgetCap}`)
  }

  const topDriverIds = driversWithPrices.slice(0, Math.min(5, driversWithPrices.length)).map((driver) => driver.entityId)
  const topTeamIds = teamsWithPrices.slice(0, Math.min(5, teamsWithPrices.length)).map((team) => team.entityId)

  for (const [index, user] of SIM_USERS.entries()) {
    const lineup = lineups[index]
    const budgetSpent = lineup.totalCost
    const teamLockedUntilRound = round + Math.max(0, context.ruleset.teamMinHoldRounds - 1)

    await db.transaction(async (tx) => {
      let [profile] = await tx
        .select()
        .from(fantasyProfiles)
        .where(eq(fantasyProfiles.sessionKey, user.sessionKey))
        .limit(1)

      if (!profile) {
        ;[profile] = await tx
          .insert(fantasyProfiles)
          .values({
            displayName: user.displayName,
            sessionKey: user.sessionKey,
            favoriteTeamId: lineup.team.entityId,
          })
          .returning()
      } else {
        ;[profile] = await tx
          .update(fantasyProfiles)
          .set({
            displayName: user.displayName,
            favoriteTeamId: lineup.team.entityId,
            updatedAt: new Date(),
          })
          .where(eq(fantasyProfiles.id, profile.id))
          .returning()
      }

      let [entry] = await tx
        .select()
        .from(fantasyRoundEntries)
        .where(
          and(
            eq(fantasyRoundEntries.profileId, profile.id),
            eq(fantasyRoundEntries.seasonId, context.fantasySeasonId),
            eq(fantasyRoundEntries.weekendId, context.weekendId),
          ),
        )
        .limit(1)

      if (!entry) {
        ;[entry] = await tx
          .insert(fantasyRoundEntries)
          .values({
            profileId: profile.id,
            seasonId: context.fantasySeasonId,
            weekendId: context.weekendId,
            status: "locked",
            budgetTotal: context.budgetCap,
            budgetSpent,
            freeDriverTransfersLeft: context.ruleset.freeDriverTransfers,
            freeEngineerTransfersLeft: context.ruleset.freeEngineerTransfers,
            teamLockedUntilRound,
            submittedAt: lockedAt,
            lockedAt,
          })
          .returning()
      } else {
        ;[entry] = await tx
          .update(fantasyRoundEntries)
          .set({
            status: "locked",
            budgetTotal: context.budgetCap,
            budgetSpent,
            freeDriverTransfersLeft: context.ruleset.freeDriverTransfers,
            freeEngineerTransfersLeft: context.ruleset.freeEngineerTransfers,
            teamLockedUntilRound,
            submittedAt: lockedAt,
            lockedAt,
            updatedAt: new Date(),
          })
          .where(eq(fantasyRoundEntries.id, entry.id))
          .returning()
      }

      await tx.delete(fantasyRoundHoldings).where(eq(fantasyRoundHoldings.entryId, entry.id))

      await tx.insert(fantasyRoundHoldings).values([
        {
          entryId: entry.id,
          slotType: "driver_1",
          assetId: lineup.drivers[0].assetId,
          lockedPrice: lineup.drivers[0].price,
          acquiredRound: round,
          isLocked: true,
        },
        {
          entryId: entry.id,
          slotType: "driver_2",
          assetId: lineup.drivers[1].assetId,
          lockedPrice: lineup.drivers[1].price,
          acquiredRound: round,
          isLocked: true,
        },
        {
          entryId: entry.id,
          slotType: "team",
          assetId: lineup.team.assetId,
          lockedPrice: lineup.team.price,
          acquiredRound: round,
          isLocked: true,
        },
        {
          entryId: entry.id,
          slotType: "engineer",
          assetId: lineup.pitWall.assetId,
          lockedPrice: lineup.pitWall.price,
          acquiredRound: round,
          isLocked: true,
        },
      ])

      const predictedPole = topDriverIds[index % topDriverIds.length] ?? lineup.drivers[0].entityId
      const predictedWinner = topDriverIds[(index + 1) % topDriverIds.length] ?? lineup.drivers[1].entityId
      const predictedP2 = topDriverIds[(index + 2) % topDriverIds.length] ?? lineup.drivers[0].entityId
      const predictedP3 = topDriverIds[(index + 3) % topDriverIds.length] ?? lineup.drivers[1].entityId
      const predictedFastestLap = topDriverIds[(index + 4) % topDriverIds.length] ?? lineup.drivers[0].entityId
      const predictedFastestPitTeam = topTeamIds[index % topTeamIds.length] ?? lineup.team.entityId

      const [existingPredictions] = await tx
        .select()
        .from(fantasyPredictions)
        .where(eq(fantasyPredictions.entryId, entry.id))
        .limit(1)

      if (!existingPredictions) {
        await tx.insert(fantasyPredictions).values({
          entryId: entry.id,
          seasonId: context.fantasySeasonId,
          weekendId: context.weekendId,
          poleDriverId: predictedPole,
          raceWinnerDriverId: predictedWinner,
          podiumP2DriverId: predictedP2,
          podiumP3DriverId: predictedP3,
          fastestLapDriverId: predictedFastestLap,
          fastestPitTeamId: predictedFastestPitTeam,
          safetyCarBand: index % 3 === 0 ? "0" : index % 3 === 1 ? "1-2" : "3+",
          hasRedFlag: index % 4 === 0,
          lockedAt,
        })
      } else {
        await tx
          .update(fantasyPredictions)
          .set({
            poleDriverId: predictedPole,
            raceWinnerDriverId: predictedWinner,
            podiumP2DriverId: predictedP2,
            podiumP3DriverId: predictedP3,
            fastestLapDriverId: predictedFastestLap,
            fastestPitTeamId: predictedFastestPitTeam,
            safetyCarBand: index % 3 === 0 ? "0" : index % 3 === 1 ? "1-2" : "3+",
            hasRedFlag: index % 4 === 0,
            lockedAt,
            updatedAt: new Date(),
          })
          .where(eq(fantasyPredictions.id, existingPredictions.id))
      }
    })
  }

  const scoring = await scoreFantasyRound(season, round)

  const simulatedProfiles = await db
    .select({ id: fantasyProfiles.id, sessionKey: fantasyProfiles.sessionKey, displayName: fantasyProfiles.displayName })
    .from(fantasyProfiles)
    .where(inArray(fantasyProfiles.sessionKey, SIM_USERS.map((user) => user.sessionKey)))

  const profileMap = new Map(simulatedProfiles.map((profile) => [profile.id, profile]))
  const allRoundScores = await db
    .select({
      profileId: fantasyProfiles.id,
      displayName: fantasyProfiles.displayName,
      sessionKey: fantasyProfiles.sessionKey,
      totalScore: fantasyRoundScores.totalScore,
      driversScore: fantasyRoundScores.driversScore,
      teamScore: fantasyRoundScores.teamScore,
      engineerScore: fantasyRoundScores.engineerScore,
      predictionsScore: fantasyRoundScores.predictionsScore,
    })
    .from(fantasyRoundScores)
    .innerJoin(fantasyRoundEntries, eq(fantasyRoundScores.entryId, fantasyRoundEntries.id))
    .innerJoin(fantasyProfiles, eq(fantasyRoundEntries.profileId, fantasyProfiles.id))
    .where(eq(fantasyRoundScores.weekendId, context.weekendId))

  const sortedAllScores = [...allRoundScores].sort((left, right) => {
    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore
    }

    return left.displayName.localeCompare(right.displayName)
  })

  const simulatedRows = sortedAllScores
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }))
    .filter((row) => profileMap.has(row.profileId))

  console.log(`\nFantasy simulation ready for season ${season}, round ${round}.`)
  console.log(`Simulated users ensured: ${SIM_USERS.length}`)
  console.log(`Entries scored this run: ${scoring?.entriesScored ?? 0}`)
  console.log(`Current round leaderboard snapshot for simulated users:\n`)

  for (const row of simulatedRows) {
    console.log(
      `${String(row.rank).padStart(2, "0")}. ${row.displayName} | total=${row.totalScore} | drivers=${row.driversScore} | team=${row.teamScore} | pitwall=${row.engineerScore} | predictions=${row.predictionsScore}`,
    )
  }

  console.log(`\nNext step in 3 days:`)
  console.log(`pnpm exec tsx scripts/simulate-fantasy-users.ts ${season} ${round + 1} ${SIM_USERS.length}`)
}

main().catch((error) => {
  console.error("Failed to simulate fantasy users:", error)
  process.exit(1)
})
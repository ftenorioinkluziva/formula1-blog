import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { and, asc, eq } from "drizzle-orm"
import { getDb } from "../lib/db/client"
import {
  drivers,
  fantasyAssetPrices,
  fantasyAssets,
  fantasyEngineers,
  fantasyRulesets,
  fantasySeasons,
  teams,
} from "../lib/db/schema"

const season = parseInt(process.argv[2] ?? "2026", 10)
const defaultRound = parseInt(process.argv[3] ?? "1", 10)

type DriverRow = {
  id: number
  code: string
  fullName: string
  shortName: string
  position: number
  points: number
  teamId: number
  teamName: string
  teamPosition: number
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function clampPrice(value: number, min: number, max: number): number {
  return Number(Math.max(min, Math.min(max, value)).toFixed(1))
}

function driverPrice(driver: DriverRow): number {
  const posScore = Math.max(0, 12 - Math.max(driver.position, 1))
  const teamScore = Math.max(0, 11 - Math.max(driver.teamPosition, 1)) * 0.6
  const pointsScore = Math.min(driver.points / 8, 5)
  return clampPrice(12 + posScore * 0.8 + teamScore + pointsScore, 8, 32)
}

function teamPrice(position: number, points: number): number {
  const posScore = Math.max(0, 11 - Math.max(position, 1))
  const pointsScore = Math.min(points / 20, 6)
  return clampPrice(14 + posScore * 1.1 + pointsScore, 10, 30)
}

function engineerPrice(teamPosition: number, teamPoints: number): number {
  const teamComponent = Math.max(0, 11 - Math.max(teamPosition, 1)) * 0.9
  const pointsScore = Math.min(teamPoints / 24, 3)
  return clampPrice(8 + teamComponent + pointsScore, 6, 18)
}

function buildPitWallIdentity(teamName: string): { displayName: string; shortName: string } {
  return {
    displayName: `${teamName} Pit Wall Lead`,
    shortName: "Pit Wall",
  }
}

async function main() {
  const db = getDb()

  if (!db) {
    throw new Error("DATABASE_URL not configured")
  }

  console.log(`\nSeeding fantasy base for season ${season}, round ${defaultRound}...\n`)

  const teamRows = await db.select().from(teams).orderBy(asc(teams.position), asc(teams.name))
  const driverRows = await db
    .select({
      id: drivers.id,
      code: drivers.code,
      fullName: drivers.fullName,
      shortName: drivers.shortName,
      position: drivers.position,
      points: drivers.points,
      teamId: teams.id,
      teamName: teams.name,
      teamPosition: teams.position,
    })
    .from(drivers)
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .orderBy(asc(teams.position), asc(drivers.position), asc(drivers.fullName))

  if (teamRows.length === 0 || driverRows.length === 0) {
    throw new Error("drivers/teams base data missing; sync standings first")
  }

  const [fantasySeason] = await db
    .insert(fantasySeasons)
    .values({
      season,
      name: `Fantasy ${season}`,
      budgetCap: 100,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: fantasySeasons.season,
      set: {
        name: `Fantasy ${season}`,
        budgetCap: 100,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning()

  await db
    .update(fantasySeasons)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(fantasySeasons.isActive, true))

  await db
    .update(fantasySeasons)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(fantasySeasons.id, fantasySeason.id))

  await db
    .insert(fantasyRulesets)
    .values({
      seasonId: fantasySeason.id,
      lockPhase: "fp1_start_30m",
      freeDriverTransfers: 2,
      freeEngineerTransfers: 1,
      extraDriverTransferPenalty: 10,
      extraEngineerTransferPenalty: 10,
      teamMinHoldRounds: 3,
      predictionsEnabled: true,
    })
    .onConflictDoUpdate({
      target: fantasyRulesets.seasonId,
      set: {
        lockPhase: "fp1_start_30m",
        freeDriverTransfers: 2,
        freeEngineerTransfers: 1,
        extraDriverTransferPenalty: 10,
        extraEngineerTransferPenalty: 10,
        teamMinHoldRounds: 3,
        predictionsEnabled: true,
        updatedAt: new Date(),
      },
    })

  const activeEngineerIds: number[] = []
  const activeEngineerAssetIds: number[] = []

  for (const team of teamRows) {
    const [asset] = await db
      .insert(fantasyAssets)
      .values({
        season,
        assetType: "team",
        displayName: team.name,
        slug: `team-${toSlug(team.name)}`,
        sourceTeamId: team.id,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [fantasyAssets.season, fantasyAssets.sourceTeamId],
        set: {
          assetType: "team",
          displayName: team.name,
          slug: `team-${toSlug(team.name)}`,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()

    await db
      .insert(fantasyAssetPrices)
      .values({
        assetId: asset.id,
        season,
        round: defaultRound,
        price: teamPrice(team.position, team.points),
        priceDelta: 0,
        performanceIndex: Number((Math.max(0, 11 - Math.max(team.position, 1)) * 10 + Math.min(team.points, 100) / 2).toFixed(1)),
        lockedAt: null,
      })
      .onConflictDoUpdate({
        target: [fantasyAssetPrices.assetId, fantasyAssetPrices.season, fantasyAssetPrices.round],
        set: {
          price: teamPrice(team.position, team.points),
          priceDelta: 0,
          performanceIndex: Number((Math.max(0, 11 - Math.max(team.position, 1)) * 10 + Math.min(team.points, 100) / 2).toFixed(1)),
        },
      })
  }

  for (const driver of driverRows) {
    const [driverAsset] = await db
      .insert(fantasyAssets)
      .values({
        season,
        assetType: "driver",
        displayName: driver.fullName,
        slug: `driver-${toSlug(driver.fullName)}`,
        sourceDriverId: driver.id,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [fantasyAssets.season, fantasyAssets.sourceDriverId],
        set: {
          assetType: "driver",
          displayName: driver.fullName,
          slug: `driver-${toSlug(driver.fullName)}`,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()

    await db
      .insert(fantasyAssetPrices)
      .values({
        assetId: driverAsset.id,
        season,
        round: defaultRound,
        price: driverPrice(driver),
        priceDelta: 0,
        performanceIndex: Number((Math.max(0, 21 - Math.max(driver.position, 1)) * 5 + Math.min(driver.points, 120) / 2).toFixed(1)),
        lockedAt: null,
      })
      .onConflictDoUpdate({
        target: [fantasyAssetPrices.assetId, fantasyAssetPrices.season, fantasyAssetPrices.round],
        set: {
          price: driverPrice(driver),
          priceDelta: 0,
          performanceIndex: Number((Math.max(0, 21 - Math.max(driver.position, 1)) * 5 + Math.min(driver.points, 120) / 2).toFixed(1)),
        },
      })
  }

  for (const team of teamRows) {
    const engineerName = buildPitWallIdentity(team.name)

    const engineerCode = `team-${toSlug(team.name)}-engineer`
    const [existingByCode] = await db
      .select()
      .from(fantasyEngineers)
      .where(and(eq(fantasyEngineers.season, season), eq(fantasyEngineers.engineerCode, engineerCode)))
      .limit(1)

    const [existingByTeam] = await db
      .select()
      .from(fantasyEngineers)
      .where(
        and(
          eq(fantasyEngineers.season, season),
          eq(fantasyEngineers.teamId, team.id),
          eq(fantasyEngineers.activeFromRound, 1),
        ),
      )
      .limit(1)

    let engineer: typeof fantasyEngineers.$inferSelect

    if (existingByCode) {
      ;[engineer] = await db
        .update(fantasyEngineers)
        .set({
          displayName: engineerName.displayName,
          shortName: engineerName.shortName,
          teamId: team.id,
          activeFromRound: 1,
          activeToRound: null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(fantasyEngineers.id, existingByCode.id))
        .returning()
    } else if (existingByTeam) {
      ;[engineer] = await db
        .update(fantasyEngineers)
        .set({
          engineerCode,
          displayName: engineerName.displayName,
          shortName: engineerName.shortName,
          teamId: team.id,
          activeFromRound: 1,
          activeToRound: null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(fantasyEngineers.id, existingByTeam.id))
        .returning()
    } else {
      ;[engineer] = await db
        .insert(fantasyEngineers)
        .values({
          season,
          engineerCode,
          displayName: engineerName.displayName,
          shortName: engineerName.shortName,
          teamId: team.id,
          activeFromRound: 1,
          activeToRound: null,
          isActive: true,
        })
        .returning()
    }

    activeEngineerIds.push(engineer.id)

    const [engineerAsset] = await db
      .insert(fantasyAssets)
      .values({
        season,
        assetType: "engineer",
        displayName: engineerName.displayName,
        slug: `engineer-${toSlug(team.name)}`,
        sourceEngineerId: engineer.id,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [fantasyAssets.season, fantasyAssets.sourceEngineerId],
        set: {
          assetType: "engineer",
          displayName: engineerName.displayName,
          slug: `engineer-${toSlug(team.name)}`,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()

    activeEngineerAssetIds.push(engineerAsset.id)

    await db
      .insert(fantasyAssetPrices)
      .values({
        assetId: engineerAsset.id,
        season,
        round: defaultRound,
        price: engineerPrice(team.position, team.points),
        priceDelta: 0,
        performanceIndex: Number((Math.max(0, 11 - Math.max(team.position, 1)) * 10 + Math.min(team.points, 100) / 3).toFixed(1)),
        lockedAt: null,
      })
      .onConflictDoUpdate({
        target: [fantasyAssetPrices.assetId, fantasyAssetPrices.season, fantasyAssetPrices.round],
        set: {
          price: engineerPrice(team.position, team.points),
          priceDelta: 0,
          performanceIndex: Number((Math.max(0, 11 - Math.max(team.position, 1)) * 10 + Math.min(team.points, 100) / 3).toFixed(1)),
        },
      })
  }

  await db
    .update(fantasyEngineers)
    .set({ isActive: false, activeToRound: defaultRound - 1, updatedAt: new Date() })
    .where(and(eq(fantasyEngineers.season, season), eq(fantasyEngineers.isActive, true)))

  for (const engineerId of activeEngineerIds) {
    await db
      .update(fantasyEngineers)
      .set({ isActive: true, activeToRound: null, updatedAt: new Date() })
      .where(eq(fantasyEngineers.id, engineerId))
  }

  await db
    .update(fantasyAssets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "engineer"), eq(fantasyAssets.isActive, true)))

  for (const assetId of activeEngineerAssetIds) {
    await db
      .update(fantasyAssets)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(fantasyAssets.id, assetId))
  }

  console.log(`Season ${season} seeded.`)
  console.log(`Ruleset ready with budget cap 100.`)
  console.log(`${teamRows.length} team assets seeded.`)
  console.log(`${driverRows.length} driver assets seeded.`)
  console.log(`${activeEngineerIds.length} engineer records seeded (one per team).`)
  console.log(`${driverRows.length + teamRows.length + activeEngineerAssetIds.length} price rows ensured for round ${defaultRound}.`)
}

main().catch((error) => {
  console.error("Failed to seed fantasy:", error)
  process.exit(1)
})
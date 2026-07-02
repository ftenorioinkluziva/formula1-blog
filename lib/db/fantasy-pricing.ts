import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  drivers,
  fantasyAssetPrices,
  fantasyAssets,
  fantasyEngineers,
  fantasyRoundScores,
  fantasyScoreItems,
  teams,
} from "@/lib/db/schema"

const DRIVER_PRICE_FLOOR = 8
const DRIVER_PRICE_CEILING = 40
const TEAM_PRICE_FLOOR = 10
const TEAM_PRICE_CEILING = 38
const ENGINEER_PRICE_FLOOR = 6
const ENGINEER_PRICE_CEILING = 22

const PERFORMANCE_WINDOW = 3
const MAX_DELTA_PER_ROUND = 5.0

function clamp(value: number, min: number, max: number): number {
  return Number(Math.max(min, Math.min(max, value)).toFixed(1))
}

function round1(value: number): number {
  return Number(value.toFixed(1))
}

interface AssetPriceContext {
  assetId: number
  assetType: "driver" | "team" | "engineer"
  currentPrice: number
  sourceDriverId: number | null
  sourceTeamId: number | null
  sourceEngineerId: number | null
}

interface DriverStanding {
  id: number
  position: number
  points: number
  teamId: number
  teamPosition: number
}

interface TeamStanding {
  id: number
  position: number
  points: number
}

async function getRecentFantasyScoreAvg(
  assetId: number,
  season: number,
  upToRound: number,
  window: number,
): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const scores = await db
    .select({ points: fantasyScoreItems.points })
    .from(fantasyScoreItems)
    .innerJoin(fantasyRoundScores, eq(fantasyScoreItems.roundScoreId, fantasyRoundScores.id))
    .where(
      and(
        eq(fantasyScoreItems.assetId, assetId),
        eq(fantasyRoundScores.seasonId, season),
        eq(fantasyRoundScores.isOfficial, true),
      ),
    )

  if (scores.length === 0) return null

  const totalByRound = new Map<number, number>()
  for (const row of scores) {
    const key = 0
    totalByRound.set(key, (totalByRound.get(key) ?? 0) + row.points)
  }

  const recentScores = scores.map((s) => s.points)
  const sum = recentScores.reduce((acc, val) => acc + val, 0)
  return sum / Math.max(recentScores.length, 1)
}

async function getAssetRecentRoundScores(
  assetId: number,
  seasonId: number,
  window: number,
): Promise<number[]> {
  const db = getDb()
  if (!db) return []

  const rows = await db
    .select({
      roundScoreId: fantasyScoreItems.roundScoreId,
      points: fantasyScoreItems.points,
    })
    .from(fantasyScoreItems)
    .innerJoin(fantasyRoundScores, eq(fantasyScoreItems.roundScoreId, fantasyRoundScores.id))
    .where(
      and(
        eq(fantasyScoreItems.assetId, assetId),
        eq(fantasyRoundScores.seasonId, seasonId),
        eq(fantasyRoundScores.isOfficial, true),
      ),
    )

  const byRoundScore = new Map<number, number>()
  for (const row of rows) {
    byRoundScore.set(row.roundScoreId, (byRoundScore.get(row.roundScoreId) ?? 0) + row.points)
  }

  const totals = Array.from(byRoundScore.values())
  return totals.slice(-window)
}

function computeDriverBasePrice(position: number, points: number, teamPosition: number): number {
  const posScore = Math.max(0, 12 - Math.max(position, 1))
  const teamScore = Math.max(0, 11 - Math.max(teamPosition, 1)) * 0.7
  const pointsScore = Math.min(points / 6, 8)
  return 14 + posScore * 1.2 + teamScore + pointsScore
}

function computeTeamBasePrice(position: number, points: number): number {
  const posScore = Math.max(0, 11 - Math.max(position, 1))
  const pointsScore = Math.min(points / 15, 9)
  return 16 + posScore * 1.5 + pointsScore
}

function computeEngineerBasePrice(teamPosition: number, teamPoints: number): number {
  const teamComponent = Math.max(0, 11 - Math.max(teamPosition, 1)) * 1.1
  const pointsScore = Math.min(teamPoints / 18, 5)
  return 9 + teamComponent + pointsScore
}

function computePerformanceIndex(
  assetType: "driver" | "team" | "engineer",
  recentScores: number[],
  standingsPosition: number,
  standingsPoints: number,
): number {
  if (recentScores.length === 0) {
    if (assetType === "driver") {
      return round1(Math.max(0, 21 - Math.max(standingsPosition, 1)) * 5 + Math.min(standingsPoints, 120) / 2)
    }
    if (assetType === "team") {
      return round1(Math.max(0, 11 - Math.max(standingsPosition, 1)) * 10 + Math.min(standingsPoints, 100) / 2)
    }
    return round1(Math.max(0, 11 - Math.max(standingsPosition, 1)) * 10 + Math.min(standingsPoints, 100) / 3)
  }

  const avgScore = recentScores.reduce((sum, val) => sum + val, 0) / recentScores.length
  const posComponent = assetType === "driver"
    ? Math.max(0, 21 - Math.max(standingsPosition, 1)) * 3
    : Math.max(0, 11 - Math.max(standingsPosition, 1)) * 6

  return round1(posComponent + avgScore * 2)
}

function computePriceDelta(
  assetType: "driver" | "team" | "engineer",
  currentPrice: number,
  basePrice: number,
  performanceIndex: number,
  recentScores: number[],
): number {
  if (recentScores.length === 0) return 0

  const avgScore = recentScores.reduce((sum, val) => sum + val, 0) / recentScores.length

  let scoreDelta: number
  if (assetType === "driver") {
    const expectedAvg = currentPrice * 0.8
    scoreDelta = (avgScore - expectedAvg) * 0.15
  } else if (assetType === "team") {
    const expectedAvg = currentPrice * 0.5
    scoreDelta = (avgScore - expectedAvg) * 0.12
  } else {
    const expectedAvg = currentPrice * 0.6
    scoreDelta = (avgScore - expectedAvg) * 0.18
  }

  const standingsDrift = (basePrice - currentPrice) * 0.25

  const rawDelta = scoreDelta + standingsDrift
  return round1(Math.max(-MAX_DELTA_PER_ROUND, Math.min(MAX_DELTA_PER_ROUND, rawDelta)))
}

export interface PriceEvolutionResult {
  season: number
  fromRound: number
  toRound: number
  updatedAssets: Array<{
    assetId: number
    assetType: string
    name: string
    oldPrice: number
    newPrice: number
    delta: number
    performanceIndex: number
  }>
}

export async function evolveFantasyPrices(
  season: number,
  fromRound: number,
  toRound: number,
): Promise<PriceEvolutionResult | null> {
  const db = getDb()
  if (!db) return null

  const allAssets = await db
    .select({
      id: fantasyAssets.id,
      assetType: fantasyAssets.assetType,
      displayName: fantasyAssets.displayName,
      sourceDriverId: fantasyAssets.sourceDriverId,
      sourceTeamId: fantasyAssets.sourceTeamId,
      sourceEngineerId: fantasyAssets.sourceEngineerId,
    })
    .from(fantasyAssets)
    .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.isActive, true)))

  if (allAssets.length === 0) return null

  const assetIds = allAssets.map((a) => a.id)
  const currentPriceRows = await db
    .select({
      assetId: fantasyAssetPrices.assetId,
      price: fantasyAssetPrices.price,
      round: fantasyAssetPrices.round,
    })
    .from(fantasyAssetPrices)
    .where(
      and(
        eq(fantasyAssetPrices.season, season),
        inArray(fantasyAssetPrices.assetId, assetIds),
      ),
    )
    .orderBy(desc(fantasyAssetPrices.round))

  const currentPrices = new Map<number, number>()
  for (const row of currentPriceRows) {
    if (!currentPrices.has(row.assetId) && row.round <= fromRound) {
      currentPrices.set(row.assetId, row.price)
    }
  }

  const driverRows = await db
    .select({
      id: drivers.id,
      position: drivers.position,
      points: drivers.points,
      teamId: teams.id,
      teamPosition: teams.position,
    })
    .from(drivers)
    .innerJoin(teams, eq(drivers.teamId, teams.id))

  const driverMap = new Map<number, DriverStanding>()
  for (const row of driverRows) {
    driverMap.set(row.id, row)
  }

  const teamRows = await db
    .select({ id: teams.id, position: teams.position, points: teams.points })
    .from(teams)

  const teamMap = new Map<number, TeamStanding>()
  for (const row of teamRows) {
    teamMap.set(row.id, row)
  }

  const engineerTeamMap = new Map<number, number>()
  const engineerRows = await db
    .select({ id: fantasyEngineers.id, teamId: fantasyEngineers.teamId })
    .from(fantasyEngineers)
    .where(and(eq(fantasyEngineers.season, season), eq(fantasyEngineers.isActive, true)))
  for (const row of engineerRows) {
    engineerTeamMap.set(row.id, row.teamId)
  }

  const seasonRows = await db
    .select({ id: fantasyAssetPrices.id })
    .from(fantasyAssetPrices)
    .where(eq(fantasyAssetPrices.season, season))
    .limit(1)

  const seasonIdRows = await db
    .select({ id: fantasyRoundScores.seasonId })
    .from(fantasyRoundScores)
    .limit(1)

  const seasonId = seasonIdRows[0]?.id ?? 0

  const updatedAssets: PriceEvolutionResult["updatedAssets"] = []

  for (const asset of allAssets) {
    const assetType = asset.assetType as "driver" | "team" | "engineer"
    const oldPrice = currentPrices.get(asset.id) ?? 0
    if (oldPrice === 0) continue

    const recentScores = await getAssetRecentRoundScores(asset.id, seasonId, PERFORMANCE_WINDOW)

    let basePrice: number
    let standingsPosition: number
    let standingsPoints: number

    if (assetType === "driver" && asset.sourceDriverId) {
      const standing = driverMap.get(asset.sourceDriverId)
      if (!standing) continue
      basePrice = computeDriverBasePrice(standing.position, standing.points, standing.teamPosition)
      standingsPosition = standing.position
      standingsPoints = standing.points
    } else if (assetType === "team" && asset.sourceTeamId) {
      const standing = teamMap.get(asset.sourceTeamId)
      if (!standing) continue
      basePrice = computeTeamBasePrice(standing.position, standing.points)
      standingsPosition = standing.position
      standingsPoints = standing.points
    } else if (assetType === "engineer" && asset.sourceEngineerId) {
      const teamId = engineerTeamMap.get(asset.sourceEngineerId)
      const standing = teamId ? teamMap.get(teamId) : undefined
      if (!standing) continue
      basePrice = computeEngineerBasePrice(standing.position, standing.points)
      standingsPosition = standing.position
      standingsPoints = standing.points
    } else {
      continue
    }

    const performanceIndex = computePerformanceIndex(assetType, recentScores, standingsPosition, standingsPoints)
    const delta = computePriceDelta(assetType, oldPrice, basePrice, performanceIndex, recentScores)

    const [floor, ceiling] = assetType === "driver"
      ? [DRIVER_PRICE_FLOOR, DRIVER_PRICE_CEILING]
      : assetType === "team"
        ? [TEAM_PRICE_FLOOR, TEAM_PRICE_CEILING]
        : [ENGINEER_PRICE_FLOOR, ENGINEER_PRICE_CEILING]

    const newPrice = clamp(oldPrice + delta, floor, ceiling)

    await db
      .insert(fantasyAssetPrices)
      .values({
        assetId: asset.id,
        season,
        round: toRound,
        price: newPrice,
        priceDelta: round1(newPrice - oldPrice),
        performanceIndex,
        lockedAt: null,
      })
      .onConflictDoUpdate({
        target: [fantasyAssetPrices.assetId, fantasyAssetPrices.season, fantasyAssetPrices.round],
        set: {
          price: newPrice,
          priceDelta: round1(newPrice - oldPrice),
          performanceIndex,
        },
      })

    updatedAssets.push({
      assetId: asset.id,
      assetType,
      name: asset.displayName,
      oldPrice,
      newPrice,
      delta: round1(newPrice - oldPrice),
      performanceIndex,
    })
  }

  return {
    season,
    fromRound,
    toRound,
    updatedAssets,
  }
}

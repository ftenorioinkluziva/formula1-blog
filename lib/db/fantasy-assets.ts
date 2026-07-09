import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getCurrentAssetPricesMap, getFantasyContext, getFantasyEntry, getFantasyProfileByUserId, type FantasyBudgetSnapshot } from "@/lib/db/fantasy-core"
import {
  drivers,
  fantasyAssets,
  fantasyEngineers,
  fantasyRoundHoldings,
  teams,
} from "@/lib/db/schema"

export interface FantasyAssetListItem {
  assetId: number
  assetType: "driver" | "team" | "engineer"
  name: string
  shortName?: string
  number?: number
  imageUrl?: string | null
  teamName?: string
  teamColor?: string
  linkedTeamId?: number
  linkedDriverId?: number
  linkedDriverSlot?: "driver_1" | "driver_2"
  price: number
  priceDelta?: number
  currentPosition?: number
  currentPoints?: number
  trendLabel?: string
  profileTag?: string
  qualifyingFormLabel?: string
  raceExecutionLabel?: string
  pitExecutionLabel?: string
  isSelected: boolean
  isDisabled: boolean
  disabledReason?: string
}

export interface FantasyAssetListResponse {
  items: FantasyAssetListItem[]
  selectedAssetIds: number[]
  budget: FantasyBudgetSnapshot | null
}

function buildDriverTrend(position: number): string {
  if (position <= 3) return "title form"
  if (position <= 8) return "points form"
  return "upside pick"
}

function buildTeamProfileTag(position: number): string {
  if (position <= 2) return "elite"
  if (position <= 5) return "balanced"
  if (position <= 8) return "value"
  return "gamble"
}

const TEAM_IMAGE_SLUG_OVERRIDES: Record<string, string> = {
  "Haas F1 Team": "haas",
  "Red Bull Racing": "redbullracing",
  "Racing Bulls": "racingbulls",
  "Aston Martin": "astonmartin",
}

function buildTeamImageUrl(teamName: string): string {
  const slug = TEAM_IMAGE_SLUG_OVERRIDES[teamName] ?? teamName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "")
  return `/images/teams/2026${slug}carright.avif`
}

function buildEngineerExecutionLabel(position: number): string {
  if (position <= 4) return "strong"
  if (position <= 10) return "solid"
  return "volatile"
}

async function getSelectedHoldingsMap(entryId: number | null): Promise<Map<string, number>> {
  const db = getDb()

  if (!db || !entryId) {
    return new Map()
  }

  const rows = await db
    .select({
      slotType: fantasyRoundHoldings.slotType,
      assetId: fantasyRoundHoldings.assetId,
    })
    .from(fantasyRoundHoldings)
    .where(eq(fantasyRoundHoldings.entryId, entryId))

  return new Map(rows.map((row) => [row.slotType, row.assetId]))
}

export async function getFantasyDriverAssets(
  season: number,
  round: number,
  userId?: string,
): Promise<FantasyAssetListResponse | null> {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  const profile = userId ? await getFantasyProfileByUserId(userId) : null
  const entry = profile ? await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId) : null
  const holdingsBySlot = await getSelectedHoldingsMap(entry?.id ?? null)

  const rows = await db
    .select({
      asset: fantasyAssets,
      driver: drivers,
      team: teams,
    })
    .from(fantasyAssets)
    .innerJoin(drivers, eq(fantasyAssets.sourceDriverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "driver"), eq(fantasyAssets.isActive, true)))
    .orderBy(asc(drivers.position), asc(drivers.fullName))

  const prices = await getCurrentAssetPricesMap(season, round, rows.map((row) => row.asset.id))
  const selectedAssetIds = Array.from(holdingsBySlot.values())
  const selectedDriverIds = new Set([holdingsBySlot.get("driver_1"), holdingsBySlot.get("driver_2")].filter(Boolean))

  return {
    items: rows.map((row) => {
      const isSelected = selectedAssetIds.includes(row.asset.id)
      const isDisabled = selectedDriverIds.has(row.asset.id) && !isSelected

      return {
        assetId: row.asset.id,
        assetType: "driver",
        name: row.driver.fullName,
        shortName: row.driver.shortName,
        number: row.driver.driverNumber,
        imageUrl: row.driver.imageUrl,
        teamName: row.team.name,
        teamColor: row.team.color,
        linkedTeamId: row.team.id,
        price: prices.get(row.asset.id)?.price ?? 0,
        priceDelta: prices.get(row.asset.id)?.delta ?? 0,
        currentPosition: row.driver.position,
        currentPoints: row.driver.points,
        trendLabel: buildDriverTrend(row.driver.position),
        isSelected,
        isDisabled,
        disabledReason: isDisabled ? "already_selected_in_other_slot" : undefined,
      }
    }),
    selectedAssetIds,
    budget: entry ? { total: entry.budgetTotal, spent: entry.budgetSpent, remaining: entry.budgetTotal - entry.budgetSpent, withinCap: entry.budgetSpent <= entry.budgetTotal } : null,
  }
}

export async function getFantasyTeamAssets(
  season: number,
  round: number,
  userId?: string,
): Promise<FantasyAssetListResponse | null> {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  const profile = userId ? await getFantasyProfileByUserId(userId) : null
  const entry = profile ? await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId) : null
  const holdingsBySlot = await getSelectedHoldingsMap(entry?.id ?? null)

  const rows = await db
    .select({
      asset: fantasyAssets,
      team: teams,
    })
    .from(fantasyAssets)
    .innerJoin(teams, eq(fantasyAssets.sourceTeamId, teams.id))
    .where(and(eq(fantasyAssets.season, season), eq(fantasyAssets.assetType, "team"), eq(fantasyAssets.isActive, true)))
    .orderBy(asc(teams.position), asc(teams.name))

  const prices = await getCurrentAssetPricesMap(season, round, rows.map((row) => row.asset.id))
  const selectedAssetIds = Array.from(holdingsBySlot.values())
  const selectedTeamAssetId = holdingsBySlot.get("team")

  return {
    items: rows.map((row) => ({
      assetId: row.asset.id,
      assetType: "team",
      name: row.team.name,
      imageUrl: buildTeamImageUrl(row.team.name),
      teamColor: row.team.color,
      linkedTeamId: row.team.id,
      price: prices.get(row.asset.id)?.price ?? 0,
      priceDelta: prices.get(row.asset.id)?.delta ?? 0,
      currentPosition: row.team.position,
      currentPoints: row.team.points,
      profileTag: buildTeamProfileTag(row.team.position),
      isSelected: selectedTeamAssetId === row.asset.id,
      isDisabled: false,
    })),
    selectedAssetIds,
    budget: entry ? { total: entry.budgetTotal, spent: entry.budgetSpent, remaining: entry.budgetTotal - entry.budgetSpent, withinCap: entry.budgetSpent <= entry.budgetTotal } : null,
  }
}

export async function getFantasyPitWallLeadAssets(
  season: number,
  round: number,
  userId: string,
): Promise<{ items: FantasyAssetListItem[]; selectedAssetIds: number[]; budget: FantasyBudgetSnapshot | null } | null> {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  const profile = await getFantasyProfileByUserId(userId)

  if (!profile) {
    return null
  }

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)

  if (!entry) {
    return null
  }

  const selectedHoldings = await getSelectedHoldingsMap(entry.id)
  const selectedEngineerAssetId = selectedHoldings.get("engineer")

  const engineerRows = await db
    .select({
      asset: fantasyAssets,
      engineer: fantasyEngineers,
      team: teams,
    })
    .from(fantasyAssets)
    .innerJoin(fantasyEngineers, eq(fantasyAssets.sourceEngineerId, fantasyEngineers.id))
    .innerJoin(teams, eq(fantasyEngineers.teamId, teams.id))
    .where(
      and(
        eq(fantasyAssets.season, season),
        eq(fantasyAssets.assetType, "engineer"),
        eq(fantasyAssets.isActive, true),
        eq(fantasyEngineers.isActive, true),
      ),
    )
    .orderBy(asc(teams.position), asc(fantasyEngineers.displayName))

  const prices = await getCurrentAssetPricesMap(season, round, engineerRows.map((row) => row.asset.id))
  const items: FantasyAssetListItem[] = engineerRows.map((row) => ({
    assetId: row.asset.id,
    assetType: "engineer",
    name: row.engineer.displayName,
    shortName: row.engineer.shortName,
    teamName: row.team.name,
    teamColor: row.team.color,
    linkedTeamId: row.team.id,
    price: prices.get(row.asset.id)?.price ?? 0,
    priceDelta: prices.get(row.asset.id)?.delta ?? 0,
    qualifyingFormLabel: buildEngineerExecutionLabel(row.team.position),
    raceExecutionLabel: buildEngineerExecutionLabel(row.team.position),
    pitExecutionLabel: row.team.position <= 5 ? "sharp" : "developing",
    isSelected: selectedEngineerAssetId === row.asset.id,
    isDisabled: false,
  }))

  return {
    items,
    selectedAssetIds: Array.from(selectedHoldings.values()),
    budget: { total: entry.budgetTotal, spent: entry.budgetSpent, remaining: entry.budgetTotal - entry.budgetSpent, withinCap: entry.budgetSpent <= entry.budgetTotal },
  }
}
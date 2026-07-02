import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { buildBudgetSnapshot, getCurrentAssetPricesMap, getFantasyContext, getFantasyEntry, getFantasyProfileBySessionKey, type FantasyBudgetSnapshot } from "@/lib/db/fantasy-core"
import {
  drivers,
  fantasyAssets,
  fantasyEngineers,
  fantasyPredictions,
  fantasyProfiles,
  fantasyRoundEntries,
  fantasyRoundHoldings,
  fantasyRoundScores,
  fantasyScoreItems,
  teams,
} from "@/lib/db/schema"

type SlotType = "driver_1" | "driver_2" | "team" | "engineer"

export interface FantasyLineupItem {
  slotType: SlotType
  assetId: number
  assetType: "driver" | "team" | "engineer"
  name: string
  shortName?: string
  teamName?: string
  teamColor?: string
  linkedTeamId?: number
  price: number
  entityId?: number
  linkedDriverId?: number
}

export interface FantasyLineupState {
  driver1: FantasyLineupItem | null
  team: FantasyLineupItem | null
  driver2: FantasyLineupItem | null
  engineer: FantasyLineupItem | null
}

export interface FantasyEligibilityState {
  isValid: boolean
  issues: string[]
  hasDriver1: boolean
  hasTeam: boolean
  hasDriver2: boolean
  hasEngineer: boolean
  hasPredictions: boolean
  budgetValid: boolean
  lockOpen: boolean
}

export interface FantasyReviewState {
  lineup: FantasyLineupState
  budget: FantasyBudgetSnapshot
  eligibility: FantasyEligibilityState
  predictions: {
    exists: boolean
    isComplete: boolean
  }
  lockStatus: string
  lockAt: string | null
}

export interface FantasyPredictionsInput {
  poleDriverId: number
  raceWinnerDriverId: number
  podiumP2DriverId: number
  podiumP3DriverId: number
  fastestLapDriverId: number
  fastestPitTeamId: number
  safetyCarBand: string
  hasRedFlag: boolean
}

export interface FantasyPredictionOptionsState {
  drivers: Array<{ id: number; name: string; shortName: string; teamName: string; teamColor: string }>
  teams: Array<{ id: number; name: string; color: string }>
  existingPredictions: FantasyPredictionsInput | null
  lockStatus: string
  lockAt: string | null
}

export interface FantasyResultBlockItem {
  id: number
  scoreType: string
  label: string
  points: number
  assetId: number | null
  sourceTable: string
  sourceRecordId: number | null
  meta: Record<string, unknown> | null
}

export interface FantasyRoundResultState {
  summary: {
    totalScore: number
    isOfficial: boolean
    lockedAt: string | null
  }
  lineup: FantasyLineupState
  blocks: {
    drivers: { subtotal: number; items: FantasyResultBlockItem[] }
    team: { subtotal: number; items: FantasyResultBlockItem[] }
    engineer: { subtotal: number; items: FantasyResultBlockItem[] }
    predictions: { subtotal: number; items: FantasyResultBlockItem[] }
  }
}

function expectedAssetType(slotType: SlotType): "driver" | "team" | "engineer" {
  if (slotType === "team") return "team"
  if (slotType === "engineer") return "engineer"
  return "driver"
}

function isPredictionsComplete(predictions: typeof fantasyPredictions.$inferSelect | null): boolean {
  if (!predictions) {
    return false
  }

  return Boolean(
    predictions.poleDriverId &&
      predictions.raceWinnerDriverId &&
      predictions.podiumP2DriverId &&
      predictions.podiumP3DriverId &&
      predictions.fastestLapDriverId &&
      predictions.fastestPitTeamId &&
      predictions.safetyCarBand &&
      predictions.hasRedFlag !== null,
  )
}

function assertFantasyEntryMutable(
  entry: typeof fantasyRoundEntries.$inferSelect,
  lockOpen: boolean,
): void {
  if (entry.status !== "draft") {
    throw new Error("entry_locked")
  }

  if (!lockOpen) {
    throw new Error("lock_closed")
  }
}

async function getLineupRows(entryId: number) {
  const db = getDb()

  if (!db) {
    return []
  }

  return db
    .select({
      holding: fantasyRoundHoldings,
      asset: fantasyAssets,
    })
    .from(fantasyRoundHoldings)
    .innerJoin(fantasyAssets, eq(fantasyRoundHoldings.assetId, fantasyAssets.id))
    .where(eq(fantasyRoundHoldings.entryId, entryId))
}

export async function ensureFantasyDraft(season: number, round: number, sessionKey: string, displayName?: string) {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  return db.transaction(async (tx) => {
    let [profile] = await tx
      .select()
      .from(fantasyProfiles)
      .where(eq(fantasyProfiles.sessionKey, sessionKey))
      .limit(1)

    if (!profile) {
      ;[profile] = await tx
        .insert(fantasyProfiles)
        .values({
          displayName: displayName?.trim() || "Fantasy Player",
          sessionKey,
        })
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
      if (!context.lockOpen) {
        throw new Error("lock_closed")
      }

      ;[entry] = await tx
        .insert(fantasyRoundEntries)
        .values({
          profileId: profile.id,
          seasonId: context.fantasySeasonId,
          weekendId: context.weekendId,
          status: "draft",
          budgetTotal: context.budgetCap,
          budgetSpent: 0,
          freeDriverTransfersLeft: context.ruleset.freeDriverTransfers,
          freeEngineerTransfersLeft: context.ruleset.freeEngineerTransfers,
        })
        .returning()
    }

    return { profile, entry, context }
  })
}

export async function getFantasyLineupState(entryId: number, season: number, round: number): Promise<FantasyLineupState> {
  const db = getDb()

  if (!db) {
    return {
      driver1: null,
      team: null,
      driver2: null,
      engineer: null,
    }
  }

  const lineupRows = await getLineupRows(entryId)
  const prices = await getCurrentAssetPricesMap(season, round, lineupRows.map((row) => row.asset.id))
  const driverIds = lineupRows.map((row) => row.asset.sourceDriverId).filter((value): value is number => value !== null)
  const teamIds = lineupRows.map((row) => row.asset.sourceTeamId).filter((value): value is number => value !== null)
  const engineerIds = lineupRows.map((row) => row.asset.sourceEngineerId).filter((value): value is number => value !== null)

  const [driverRows, teamRows, engineerRows] = await Promise.all([
    driverIds.length > 0
      ? db
          .select({ driver: drivers, team: teams })
          .from(drivers)
          .innerJoin(teams, eq(drivers.teamId, teams.id))
          .where(inArray(drivers.id, driverIds))
      : Promise.resolve([]),
    teamIds.length > 0
      ? db
          .select()
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : Promise.resolve([]),
    engineerIds.length > 0
      ? db
          .select({ engineer: fantasyEngineers, team: teams })
          .from(fantasyEngineers)
          .innerJoin(teams, eq(fantasyEngineers.teamId, teams.id))
          .where(inArray(fantasyEngineers.id, engineerIds))
      : Promise.resolve([]),
  ])

  const driverById = new Map(driverRows.map((row) => [row.driver.id, row]))
  const teamById = new Map(teamRows.map((row) => [row.id, row]))
  const engineerById = new Map(engineerRows.map((row) => [row.engineer.id, row]))

  const state: FantasyLineupState = {
    driver1: null,
    team: null,
    driver2: null,
    engineer: null,
  }

  for (const row of lineupRows) {
    const slotType = row.holding.slotType as SlotType

    if (row.asset.assetType === "driver" && row.asset.sourceDriverId) {
      const driverRow = driverById.get(row.asset.sourceDriverId)

      if (!driverRow) {
        continue
      }

      state[slotType === "driver_2" ? "driver2" : "driver1"] = {
        slotType,
        assetId: row.asset.id,
        assetType: "driver",
        name: driverRow.driver.fullName,
        shortName: driverRow.driver.shortName,
        teamName: driverRow.team.name,
        teamColor: driverRow.team.color,
        linkedTeamId: driverRow.team.id,
        price: prices.get(row.asset.id) ?? 0,
        entityId: driverRow.driver.id,
        linkedDriverId: driverRow.driver.id,
      }
      continue
    }

    if (row.asset.assetType === "team" && row.asset.sourceTeamId) {
      const teamRow = teamById.get(row.asset.sourceTeamId)

      if (!teamRow) {
        continue
      }

      state.team = {
        slotType,
        assetId: row.asset.id,
        assetType: "team",
        name: teamRow.name,
        teamColor: teamRow.color,
        linkedTeamId: teamRow.id,
        price: prices.get(row.asset.id) ?? 0,
        entityId: teamRow.id,
      }
      continue
    }

    if (row.asset.assetType === "engineer" && row.asset.sourceEngineerId) {
      const engineerRow = engineerById.get(row.asset.sourceEngineerId)

      if (!engineerRow) {
        continue
      }

      state.engineer = {
        slotType,
        assetId: row.asset.id,
        assetType: "engineer",
        name: engineerRow.engineer.displayName,
        shortName: engineerRow.engineer.shortName,
        teamName: engineerRow.team.name,
        teamColor: engineerRow.team.color,
        linkedTeamId: engineerRow.team.id,
        price: prices.get(row.asset.id) ?? 0,
        entityId: engineerRow.engineer.id,
      }
    }
  }

  return state
}

export function getBudgetFromLineup(lineup: FantasyLineupState, total: number): FantasyBudgetSnapshot {
  const spent = [lineup.driver1, lineup.team, lineup.driver2, lineup.engineer]
    .filter((item): item is FantasyLineupItem => item !== null)
    .reduce((sum, item) => sum + item.price, 0)

  return buildBudgetSnapshot(total, spent)
}

export function getFantasyEligibilityState(
  lineup: FantasyLineupState,
  budget: FantasyBudgetSnapshot,
  hasPredictions: boolean,
  lockOpen: boolean,
): FantasyEligibilityState {
  const hasDriver1 = Boolean(lineup.driver1)
  const hasTeam = Boolean(lineup.team)
  const hasDriver2 = Boolean(lineup.driver2)
  const hasEngineer = Boolean(lineup.engineer)

  const issues: string[] = []

  if (!hasDriver1) issues.push("missing_driver_1")
  if (!hasTeam) issues.push("missing_team")
  if (!hasDriver2) issues.push("missing_driver_2")
  if (!hasEngineer) issues.push("missing_engineer")
  if (!hasPredictions) issues.push("missing_predictions")
  if (!budget.withinCap) issues.push("budget_exceeded")
  if (!lockOpen) issues.push("lock_closed")

  return {
    isValid: issues.length === 0,
    issues,
    hasDriver1,
    hasTeam,
    hasDriver2,
    hasEngineer,
    hasPredictions,
    budgetValid: budget.withinCap,
    lockOpen,
  }
}

export async function getFantasyReviewState(
  season: number,
  round: number,
  sessionKey: string,
): Promise<FantasyReviewState | null> {
  const context = await getFantasyContext(season, round)
  const profile = await getFantasyProfileBySessionKey(sessionKey)

  if (!context || !profile) {
    return null
  }

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)

  if (!entry) {
    return null
  }

  const db = getDb()

  if (!db) {
    return null
  }

  const lineup = await getFantasyLineupState(entry.id, season, round)
  const budget = getBudgetFromLineup(lineup, entry.budgetTotal)
  const [predictions] = await db
    .select()
    .from(fantasyPredictions)
    .where(eq(fantasyPredictions.entryId, entry.id))
    .limit(1)

  const predictionsComplete = isPredictionsComplete(predictions ?? null)
  const eligibility = getFantasyEligibilityState(lineup, budget, predictionsComplete, context.lockOpen)

  return {
    lineup,
    budget,
    eligibility,
    predictions: {
      exists: Boolean(predictions),
      isComplete: predictionsComplete,
    },
    lockStatus: context.lockStatus,
    lockAt: context.lockAt,
  }
}

export async function upsertFantasyHolding(
  season: number,
  round: number,
  sessionKey: string,
  slotType: SlotType,
  assetId: number,
) {
  const db = getDb()
  const ensured = await ensureFantasyDraft(season, round, sessionKey)

  if (!db || !ensured) {
    return null
  }

  const { entry, context } = ensured
  assertFantasyEntryMutable(entry, context.lockOpen)
  const invalidations: string[] = []

  const [asset] = await db
    .select()
    .from(fantasyAssets)
    .where(and(eq(fantasyAssets.id, assetId), eq(fantasyAssets.season, season), eq(fantasyAssets.isActive, true)))
    .limit(1)

  if (!asset) {
    throw new Error("asset_not_found")
  }

  if (asset.assetType !== expectedAssetType(slotType)) {
    throw new Error("asset_type_mismatch")
  }

  const currentLineup = await getFantasyLineupState(entry.id, season, round)

  if (slotType === "driver_1" && currentLineup.driver2?.assetId === assetId) {
    throw new Error("driver_already_selected")
  }

  if (slotType === "driver_2" && currentLineup.driver1?.assetId === assetId) {
    throw new Error("driver_already_selected")
  }

  const [existingHolding] = await db
    .select()
    .from(fantasyRoundHoldings)
    .where(and(eq(fantasyRoundHoldings.entryId, entry.id), eq(fantasyRoundHoldings.slotType, slotType)))
    .limit(1)

  const prices = await getCurrentAssetPricesMap(season, round, [assetId])
  const lockedPrice = prices.get(assetId) ?? 0

  if (existingHolding) {
    await db
      .update(fantasyRoundHoldings)
      .set({
        assetId,
        lockedPrice,
        acquiredRound: round,
      })
      .where(eq(fantasyRoundHoldings.id, existingHolding.id))
  } else {
    await db.insert(fantasyRoundHoldings).values({
      entryId: entry.id,
      slotType,
      assetId,
      lockedPrice,
      acquiredRound: round,
      isLocked: false,
    })
  }

  const lineup = await getFantasyLineupState(entry.id, season, round)
  const budget = getBudgetFromLineup(lineup, entry.budgetTotal)

  if (!budget.withinCap) {
    invalidations.push("budget_exceeded")
  }

  const [predictions] = await db
    .select()
    .from(fantasyPredictions)
    .where(eq(fantasyPredictions.entryId, entry.id))
    .limit(1)

  const eligibility = getFantasyEligibilityState(lineup, budget, isPredictionsComplete(predictions ?? null), context.lockOpen)

  await db
    .update(fantasyRoundEntries)
    .set({
      budgetSpent: budget.spent,
      updatedAt: new Date(),
    })
    .where(eq(fantasyRoundEntries.id, entry.id))

  return {
    lineup,
    budget,
    eligibility,
    invalidations,
  }
}

export async function removeFantasyHolding(
  season: number,
  round: number,
  sessionKey: string,
  slotType: SlotType,
): Promise<{ lineup: FantasyLineupState; budget: FantasyBudgetSnapshot; eligibility: FantasyEligibilityState } | null> {
  const context = await getFantasyContext(season, round)
  if (!context) return null

  const profile = await getFantasyProfileBySessionKey(sessionKey)
  if (!profile) return null

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)
  if (!entry) return null

  assertFantasyEntryMutable(entry, context.lockOpen)

  const db = getDb()
  if (!db) return null

  await db
    .delete(fantasyRoundHoldings)
    .where(
      and(
        eq(fantasyRoundHoldings.entryId, entry.id),
        eq(fantasyRoundHoldings.slotType, slotType),
      )
    )

  const lineup = await getFantasyLineupState(entry.id, season, round)
  const budget = getBudgetFromLineup(lineup, entry.budgetTotal)

  const [predictions] = await db
    .select()
    .from(fantasyPredictions)
    .where(eq(fantasyPredictions.entryId, entry.id))
    .limit(1)

  const eligibility = getFantasyEligibilityState(lineup, budget, isPredictionsComplete(predictions ?? null), context.lockOpen)

  await db
    .update(fantasyRoundEntries)
    .set({ budgetSpent: budget.spent, updatedAt: new Date() })
    .where(eq(fantasyRoundEntries.id, entry.id))

  return { lineup, budget, eligibility }
}

function toPredictionsInput(predictions: typeof fantasyPredictions.$inferSelect): FantasyPredictionsInput {
  return {
    poleDriverId: predictions.poleDriverId ?? 0,
    raceWinnerDriverId: predictions.raceWinnerDriverId ?? 0,
    podiumP2DriverId: predictions.podiumP2DriverId ?? 0,
    podiumP3DriverId: predictions.podiumP3DriverId ?? 0,
    fastestLapDriverId: predictions.fastestLapDriverId ?? 0,
    fastestPitTeamId: predictions.fastestPitTeamId ?? 0,
    safetyCarBand: predictions.safetyCarBand ?? "",
    hasRedFlag: predictions.hasRedFlag ?? false,
  }
}

const SCORE_ITEM_LABELS: Record<string, string> = {
  "driver:qualifying_position": "Qualifying position",
  "driver:qualifying_dsq": "Qualifying DSQ",
  "driver:teammate_quali_beat": "Beat teammate in qualifying",
  "driver:sprint_position": "Sprint position",
  "driver:sprint_overtakes": "Sprint overtakes",
  "driver:sprint_dnf": "Sprint DNF",
  "driver:teammate_sprint_beat": "Beat teammate in sprint",
  "driver:race_position": "Race position",
  "driver:race_overtakes": "Race overtakes",
  "driver:fastest_lap": "Fastest lap",
  "driver:race_dnf": "Race DNF",
  "driver:teammate_race_beat": "Beat teammate in race",
  "team:q3_one_car": "One car in Q3",
  "team:q3_both_cars": "Both cars in Q3",
  "team:qualifying_dsq": "Qualifying DSQ",
  "team:sprint_both_finish": "Both finished sprint",
  "team:sprint_both_top8": "Both top 8 in sprint",
  "team:sprint_dnf": "Sprint DNF",
  "team:race_both_finish": "Both finished race",
  "team:race_both_points": "Both in points",
  "team:race_podium": "Podium",
  "team:race_win": "Race win",
  "team:race_dnf": "Race DNF",
  "team:pit_crew_fast": "Fast pit stop",
  "team:pit_crew_slow": "Slow pit stop",
  "engineer:strategy_quali_execution": "Qualifying strategy",
  "engineer:strategy_race_gain": "Race strategy gain",
  "engineer:strategy_points_conversion": "Points conversion",
  "engineer:strategy_position_lost": "Strategy lost positions",
  "engineer:strategy_dnf_penalty": "DNF penalty",
  "engineer:strategy_clean_race": "Clean race management",
  "engineer:strategy_undercut_overcut": "Undercut/overcut",
  "engineer:strategy_sc_window": "SC window gain",
  "prediction:predicted_pole": "Predicted pole",
  "prediction:predicted_winner": "Predicted winner",
  "prediction:predicted_podium_p1": "Predicted P1 podium",
  "prediction:predicted_podium_p2": "Predicted P2 podium",
  "prediction:predicted_podium_p3": "Predicted P3 podium",
  "prediction:predicted_fastest_lap": "Predicted fastest lap",
  "prediction:predicted_fastest_pit": "Predicted fastest pit",
  "prediction:predicted_safety_car_band": "Predicted SC band",
  "prediction:predicted_red_flag": "Predicted red flag",
  "prediction:prediction_combo_pole_win_fastest_lap": "Combo: pole + win + FL",
  "prediction:prediction_combo_exact_podium": "Combo: exact podium",
}

function mapScoreItemLabel(scoreBlock: string, scoreType: string): string {
  return SCORE_ITEM_LABELS[`${scoreBlock}:${scoreType}`] ?? scoreType.replaceAll("_", " ")
}

export async function getFantasyPredictionOptions(
  season: number,
  round: number,
  sessionKey: string,
): Promise<FantasyPredictionOptionsState | null> {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  const profile = await getFantasyProfileBySessionKey(sessionKey)

  if (!profile) {
    return null
  }

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)

  if (!entry) {
    return null
  }

  const [driverRows, teamRows, existingPredictions] = await Promise.all([
    db
      .select({
        id: drivers.id,
        name: drivers.fullName,
        shortName: drivers.shortName,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(drivers)
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .orderBy(asc(drivers.position), asc(drivers.fullName)),
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).orderBy(asc(teams.position), asc(teams.name)),
    db
      .select()
      .from(fantasyPredictions)
      .where(eq(fantasyPredictions.entryId, entry.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  return {
    drivers: driverRows,
    teams: teamRows,
    existingPredictions: existingPredictions ? toPredictionsInput(existingPredictions) : null,
    lockStatus: context.lockStatus,
    lockAt: context.lockAt,
  }
}

export async function saveFantasyPredictions(
  season: number,
  round: number,
  sessionKey: string,
  predictions: FantasyPredictionsInput,
) {
  const db = getDb()
  const ensured = await ensureFantasyDraft(season, round, sessionKey)

  if (!db || !ensured) {
    return null
  }

  const { entry, context } = ensured
  assertFantasyEntryMutable(entry, context.lockOpen)
  const [existing] = await db
    .select()
    .from(fantasyPredictions)
    .where(eq(fantasyPredictions.entryId, entry.id))
    .limit(1)

  if (existing) {
    await db
      .update(fantasyPredictions)
      .set({
        ...predictions,
        updatedAt: new Date(),
      })
      .where(eq(fantasyPredictions.id, existing.id))
  } else {
    await db.insert(fantasyPredictions).values({
      entryId: entry.id,
      seasonId: context.fantasySeasonId,
      weekendId: context.weekendId,
      ...predictions,
    })
  }

  const lineup = await getFantasyLineupState(entry.id, season, round)
  const budget = getBudgetFromLineup(lineup, entry.budgetTotal)
  const eligibility = getFantasyEligibilityState(lineup, budget, true, context.lockOpen)

  return {
    predictions,
    eligibility,
    lockStatus: context.lockStatus,
    lockAt: context.lockAt,
  }
}

export async function lockFantasyEntry(season: number, round: number, sessionKey: string) {
  const db = getDb()
  const review = await getFantasyReviewState(season, round, sessionKey)
  const profile = await getFantasyProfileBySessionKey(sessionKey)
  const context = await getFantasyContext(season, round)

  if (!db || !review || !profile || !context) {
    return null
  }

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)

  if (!entry) {
    return null
  }

  if (!review.eligibility.isValid) {
    throw new Error("entry_not_eligible_for_lock")
  }

  if (!context.lockOpen) {
    throw new Error("lock_closed")
  }

  const lockedAt = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(fantasyRoundHoldings)
      .set({ isLocked: true })
      .where(eq(fantasyRoundHoldings.entryId, entry.id))

    await tx
      .update(fantasyPredictions)
      .set({ lockedAt, updatedAt: lockedAt })
      .where(eq(fantasyPredictions.entryId, entry.id))

    await tx
      .update(fantasyRoundEntries)
      .set({
        status: "locked",
        budgetSpent: review.budget.spent,
        submittedAt: lockedAt,
        lockedAt,
        updatedAt: lockedAt,
      })
      .where(eq(fantasyRoundEntries.id, entry.id))
  })

  return {
    success: true,
    entryId: entry.id,
    lockedAt: lockedAt.toISOString(),
    lineup: review.lineup,
    predictions: review.predictions,
    budget: review.budget,
  }
}

export async function getFantasyRoundResult(
  season: number,
  round: number,
  sessionKey: string,
): Promise<FantasyRoundResultState | null> {
  const db = getDb()
  const profile = await getFantasyProfileBySessionKey(sessionKey)
  const context = await getFantasyContext(season, round)

  if (!db || !profile || !context) {
    return null
  }

  const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)

  if (!entry) {
    return null
  }

  const lineup = await getFantasyLineupState(entry.id, season, round)
  const [score] = await db
    .select()
    .from(fantasyRoundScores)
    .where(eq(fantasyRoundScores.entryId, entry.id))
    .limit(1)

  if (!score) {
    return {
      summary: {
        totalScore: 0,
        isOfficial: false,
        lockedAt: entry.lockedAt?.toISOString() ?? null,
      },
      lineup,
      blocks: {
        drivers: { subtotal: 0, items: [] },
        team: { subtotal: 0, items: [] },
        engineer: { subtotal: 0, items: [] },
        predictions: { subtotal: 0, items: [] },
      },
    }
  }

  const items = await db
    .select()
    .from(fantasyScoreItems)
    .where(eq(fantasyScoreItems.roundScoreId, score.id))

  const blocks = {
    drivers: { subtotal: score.driversScore, items: [] as FantasyResultBlockItem[] },
    team: { subtotal: score.teamScore, items: [] as FantasyResultBlockItem[] },
    engineer: { subtotal: score.engineerScore, items: [] as FantasyResultBlockItem[] },
    predictions: { subtotal: score.predictionsScore, items: [] as FantasyResultBlockItem[] },
  }

  for (const item of items) {
    const normalized: FantasyResultBlockItem = {
      id: item.id,
      scoreType: item.scoreType,
      label: mapScoreItemLabel(item.scoreBlock, item.scoreType),
      points: item.points,
      assetId: item.assetId,
      sourceTable: item.sourceTable,
      sourceRecordId: item.sourceRecordId,
      meta: (item.metaJson as Record<string, unknown> | null) ?? null,
    }

    if (item.scoreBlock === "driver") {
      blocks.drivers.items.push(normalized)
    } else if (item.scoreBlock === "team") {
      blocks.team.items.push(normalized)
    } else if (item.scoreBlock === "engineer") {
      blocks.engineer.items.push(normalized)
    } else if (item.scoreBlock === "prediction") {
      blocks.predictions.items.push(normalized)
    }
  }

  return {
    summary: {
      totalScore: score.totalScore,
      isOfficial: score.isOfficial,
      lockedAt: entry.lockedAt?.toISOString() ?? null,
    },
    lineup,
    blocks,
  }
}
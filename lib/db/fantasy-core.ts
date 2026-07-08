import { and, asc, desc, eq, inArray, lte } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  fantasyAssetPrices,
  fantasyProfiles,
  fantasyRoundEntries,
  fantasyRulesets,
  fantasySeasons,
  raceSessions,
  raceWeekends,
} from "@/lib/db/schema"

export type FantasyLockStatus = "open" | "closing_soon" | "locked" | "finished"

export interface FantasyBudgetSnapshot {
  total: number
  spent: number
  remaining: number
  withinCap: boolean
}

export interface FantasyContext {
  fantasySeasonId: number
  fantasySeason: number
  budgetCap: number
  weekendId: number
  weekendName: string
  circuit: string
  country: string
  location: string
  ruleset: {
    freeDriverTransfers: number
    freeEngineerTransfers: number
    teamMinHoldRounds: number
    lockPhase: string
    predictionsEnabled: boolean
  }
  lockAt: string | null
  lockStatus: FantasyLockStatus
  lockOpen: boolean
}

function resolveLockStatus(lockAt: Date | null, weekendEndAt: Date | null): FantasyLockStatus {
  const now = Date.now()

  if (weekendEndAt && now > weekendEndAt.getTime()) {
    return "finished"
  }

  if (!lockAt) {
    return "open"
  }

  const deltaMs = lockAt.getTime() - now

  if (deltaMs <= 0) {
    return "locked"
  }

  if (deltaMs <= 24 * 60 * 60 * 1000) {
    return "closing_soon"
  }

  return "open"
}

export async function getFantasyContext(season: number, round: number): Promise<FantasyContext | null> {
  const db = getDb()

  if (!db) {
    return null
  }

  const [seasonRow] = await db
    .select()
    .from(fantasySeasons)
    .where(eq(fantasySeasons.season, season))
    .limit(1)

  if (!seasonRow) {
    return null
  }

  const [ruleset] = await db
    .select()
    .from(fantasyRulesets)
    .where(eq(fantasyRulesets.seasonId, seasonRow.id))
    .limit(1)

  const [weekend] = await db
    .select()
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, round)))
    .limit(1)

  if (!weekend) {
    return null
  }

  const sessions = await db
    .select()
    .from(raceSessions)
    .where(eq(raceSessions.weekendId, weekend.id))
    .orderBy(asc(raceSessions.startTimeUtc))

  const fp1Session =
    sessions.find((session) => session.sessionCode === "P1") ??
    sessions.find((session) => session.sessionCode === "FP1") ??
    sessions[0] ??
    null

  const lockPhase = ruleset?.lockPhase ?? "fp1_start_30m"
  let lockAt: Date | null = null

  if (lockPhase === "qualifying_start") {
    const qualiSession =
      sessions.find((session) => session.sessionCode === "Q") ??
      sessions.find((session) => session.sessionType.toLowerCase() === "qualifying") ??
      null
    lockAt = qualiSession?.startTimeUtc ?? null
  } else {
    const THIRTY_MINUTES_MS = 30 * 60 * 1000
    lockAt =
      fp1Session?.startTimeUtc
        ? new Date(fp1Session.startTimeUtc.getTime() - THIRTY_MINUTES_MS)
        : null
  }

  const weekendEndAt = sessions.length > 0 ? sessions[sessions.length - 1].endTimeUtc : null
  const lockStatus = resolveLockStatus(lockAt, weekendEndAt)

  return {
    fantasySeasonId: seasonRow.id,
    fantasySeason: seasonRow.season,
    budgetCap: seasonRow.budgetCap,
    weekendId: weekend.id,
    weekendName: weekend.grandPrixName,
    circuit: weekend.circuit,
    country: weekend.country,
    location: weekend.location,
    ruleset: {
      freeDriverTransfers: ruleset?.freeDriverTransfers ?? 2,
      freeEngineerTransfers: ruleset?.freeEngineerTransfers ?? 1,
      teamMinHoldRounds: ruleset?.teamMinHoldRounds ?? 3,
      lockPhase: ruleset?.lockPhase ?? "qualifying_start",
      predictionsEnabled: ruleset?.predictionsEnabled ?? true,
    },
    lockAt: lockAt?.toISOString() ?? null,
    lockStatus,
    lockOpen: lockStatus === "open" || lockStatus === "closing_soon",
  }
}

export async function getFantasyProfileBySessionKey(sessionKey: string) {
  const db = getDb()

  if (!db) {
    return null
  }

  const [profile] = await db
    .select()
    .from(fantasyProfiles)
    .where(eq(fantasyProfiles.sessionKey, sessionKey))
    .limit(1)

  return profile ?? null
}

export async function getFantasyEntry(profileId: number, seasonId: number, weekendId: number) {
  const db = getDb()

  if (!db) {
    return null
  }

  const [entry] = await db
    .select()
    .from(fantasyRoundEntries)
    .where(
      and(
        eq(fantasyRoundEntries.profileId, profileId),
        eq(fantasyRoundEntries.seasonId, seasonId),
        eq(fantasyRoundEntries.weekendId, weekendId),
      ),
    )
    .limit(1)

  return entry ?? null
}

export async function getCurrentAssetPricesMap(
  season: number,
  round: number,
  assetIds: number[],
): Promise<Map<number, { price: number; delta: number }>> {
  const db = getDb()

  if (!db || assetIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      assetId: fantasyAssetPrices.assetId,
      price: fantasyAssetPrices.price,
      priceDelta: fantasyAssetPrices.priceDelta,
      round: fantasyAssetPrices.round,
    })
    .from(fantasyAssetPrices)
    .where(
      and(
        eq(fantasyAssetPrices.season, season),
        lte(fantasyAssetPrices.round, round),
        inArray(fantasyAssetPrices.assetId, assetIds),
      ),
    )
    .orderBy(desc(fantasyAssetPrices.round))

  const prices = new Map<number, { price: number; delta: number }>()

  for (const row of rows) {
    if (!prices.has(row.assetId)) {
      prices.set(row.assetId, { price: row.price, delta: row.priceDelta })
    }
  }

  return prices
}

export function buildBudgetSnapshot(total: number, spent: number): FantasyBudgetSnapshot {
  const normalizedSpent = Number(spent.toFixed(2))
  const remaining = Number((total - normalizedSpent).toFixed(2))

  return {
    total,
    spent: normalizedSpent,
    remaining,
    withinCap: remaining >= 0,
  }
}
import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getFantasyContext, getFantasyProfileBySessionKey } from "@/lib/db/fantasy-core"
import { fantasyProfiles, fantasyRoundEntries, fantasyRoundScores, raceWeekends } from "@/lib/db/schema"

export interface FantasyLeaderboardEntry {
  rank: number
  profileId: number
  displayName: string
  totalScore: number
  roundsCount: number
  averageScore: number
  lastCalculatedAt: string | null
  isCurrentProfile: boolean
}

export interface FantasyRoundLeaderboardState {
  season: number
  round: number
  weekendId: number
  weekendName: string
  isOfficial: boolean
  entries: FantasyLeaderboardEntry[]
  currentProfileEntry: FantasyLeaderboardEntry | null
}

export interface FantasySeasonLeaderboardState {
  season: number
  entries: FantasyLeaderboardEntry[]
  currentProfileEntry: FantasyLeaderboardEntry | null
}

export interface FantasyLeaderboardState {
  round: FantasyRoundLeaderboardState | null
  season: {
    live: FantasySeasonLeaderboardState
    official: FantasySeasonLeaderboardState
  }
}

interface BaseLeaderboardRow {
  profileId: number
  displayName: string
  totalScore: number
  roundsCount: number
  lastCalculatedAt: Date | null
}

function rankLeaderboardRows(rows: BaseLeaderboardRow[], currentProfileId: number | null): FantasyLeaderboardEntry[] {
  const sortedRows = [...rows].sort((left, right) => {
    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore
    }

    if ((left.lastCalculatedAt?.getTime() ?? 0) !== (right.lastCalculatedAt?.getTime() ?? 0)) {
      return (left.lastCalculatedAt?.getTime() ?? 0) - (right.lastCalculatedAt?.getTime() ?? 0)
    }

    return left.displayName.localeCompare(right.displayName)
  })

  let previousScore: number | null = null
  let previousRank = 0

  return sortedRows.map((row, index) => {
    const rank = previousScore === row.totalScore ? previousRank : index + 1
    previousScore = row.totalScore
    previousRank = rank

    return {
      rank,
      profileId: row.profileId,
      displayName: row.displayName,
      totalScore: row.totalScore,
      roundsCount: row.roundsCount,
      averageScore: row.roundsCount > 0 ? Number((row.totalScore / row.roundsCount).toFixed(1)) : 0,
      lastCalculatedAt: row.lastCalculatedAt?.toISOString() ?? null,
      isCurrentProfile: currentProfileId === row.profileId,
    }
  })
}

export async function getFantasyLeaderboard(
  season: number,
  round: number,
  sessionKey?: string,
): Promise<FantasyLeaderboardState | null> {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  const profile = sessionKey ? await getFantasyProfileBySessionKey(sessionKey) : null
  const currentProfileId = profile?.id ?? null

  const [weekendRow] = await db
    .select({ id: raceWeekends.id, grandPrixName: raceWeekends.grandPrixName })
    .from(raceWeekends)
    .where(eq(raceWeekends.id, context.weekendId))
    .limit(1)

  const scoreRows = await db
    .select({
      totalScore: fantasyRoundScores.totalScore,
      isOfficial: fantasyRoundScores.isOfficial,
      calculatedAt: fantasyRoundScores.calculatedAt,
      weekendId: fantasyRoundScores.weekendId,
      profileId: fantasyProfiles.id,
      displayName: fantasyProfiles.displayName,
    })
    .from(fantasyRoundScores)
    .innerJoin(fantasyRoundEntries, eq(fantasyRoundScores.entryId, fantasyRoundEntries.id))
    .innerJoin(fantasyProfiles, eq(fantasyRoundEntries.profileId, fantasyProfiles.id))
    .where(eq(fantasyRoundScores.seasonId, context.fantasySeasonId))
    .orderBy(asc(fantasyProfiles.displayName))

  const roundRows = scoreRows
    .filter((row) => row.weekendId === context.weekendId)
    .map((row) => ({
      profileId: row.profileId,
      displayName: row.displayName,
      totalScore: row.totalScore,
      roundsCount: 1,
      lastCalculatedAt: row.calculatedAt,
    }))

  const seasonMap = new Map<number, BaseLeaderboardRow>()
  const officialSeasonMap = new Map<number, BaseLeaderboardRow>()

  for (const row of scoreRows) {
    const existing = seasonMap.get(row.profileId)

    if (existing) {
      existing.totalScore += row.totalScore
      existing.roundsCount += 1
      if (!existing.lastCalculatedAt || (row.calculatedAt && row.calculatedAt > existing.lastCalculatedAt)) {
        existing.lastCalculatedAt = row.calculatedAt
      }
    } else {
      seasonMap.set(row.profileId, {
        profileId: row.profileId,
        displayName: row.displayName,
        totalScore: row.totalScore,
        roundsCount: 1,
        lastCalculatedAt: row.calculatedAt,
      })
    }

    if (!row.isOfficial) {
      continue
    }

    const officialExisting = officialSeasonMap.get(row.profileId)

    if (officialExisting) {
      officialExisting.totalScore += row.totalScore
      officialExisting.roundsCount += 1
      if (!officialExisting.lastCalculatedAt || (row.calculatedAt && row.calculatedAt > officialExisting.lastCalculatedAt)) {
        officialExisting.lastCalculatedAt = row.calculatedAt
      }
    } else {
      officialSeasonMap.set(row.profileId, {
        profileId: row.profileId,
        displayName: row.displayName,
        totalScore: row.totalScore,
        roundsCount: 1,
        lastCalculatedAt: row.calculatedAt,
      })
    }
  }

  const roundEntries = rankLeaderboardRows(roundRows, currentProfileId)
  const seasonEntries = rankLeaderboardRows(Array.from(seasonMap.values()), currentProfileId)
  const officialSeasonEntries = rankLeaderboardRows(Array.from(officialSeasonMap.values()), currentProfileId)

  return {
    round: weekendRow
      ? {
          season,
          round,
          weekendId: weekendRow.id,
          weekendName: weekendRow.grandPrixName,
          isOfficial: scoreRows.filter((row) => row.weekendId === context.weekendId).every((row) => row.isOfficial),
          entries: roundEntries,
          currentProfileEntry: roundEntries.find((entry) => entry.profileId === currentProfileId) ?? null,
        }
      : null,
    season: {
      live: {
        season,
        entries: seasonEntries,
        currentProfileEntry: seasonEntries.find((entry) => entry.profileId === currentProfileId) ?? null,
      },
      official: {
        season,
        entries: officialSeasonEntries,
        currentProfileEntry: officialSeasonEntries.find((entry) => entry.profileId === currentProfileId) ?? null,
      },
    },
  }
}
import { eq, and } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { raceWeekends } from "@/lib/db/schema"
import { fetchSeasonSchedule, type JolpicaScheduleRace } from "@/lib/jolpica/client"

export interface ExternalRoundResolution {
  season: number
  localRound: number
  externalRound: number
  localGrandPrixName: string | null
  externalRaceName: string | null
  shifted: boolean
}

function normalizeRaceName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/grand prix/g, "")
    .replace(/gp/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function scoreScheduleMatch(localName: string, race: JolpicaScheduleRace): number {
  const externalName = normalizeRaceName(race.raceName)
  if (localName === externalName) {
    return 1000
  }

  if (localName.includes(externalName) || externalName.includes(localName)) {
    return 500
  }

  const localTokens = new Set(localName.split(" ").filter(Boolean))
  const externalTokens = new Set(externalName.split(" ").filter(Boolean))
  let overlap = 0

  for (const token of localTokens) {
    if (externalTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap
}

export async function resolveExternalRound(
  season: number,
  localRound: number,
): Promise<ExternalRoundResolution> {
  const db = getDb()
  const [weekend] = db
    ? await db
        .select({ grandPrixName: raceWeekends.grandPrixName })
        .from(raceWeekends)
        .where(and(eq(raceWeekends.season, season), eq(raceWeekends.round, localRound)))
        .limit(1)
    : []

  const localGrandPrixName = weekend?.grandPrixName ?? null
  const schedule = await fetchSeasonSchedule(season)

  if (!localGrandPrixName) {
    return {
      season,
      localRound,
      externalRound: localRound,
      localGrandPrixName: null,
      externalRaceName: null,
      shifted: false,
    }
  }

  const normalizedLocal = normalizeRaceName(localGrandPrixName)
  const ranked = schedule
    .map((race) => ({
      race,
      score: scoreScheduleMatch(normalizedLocal, race),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return Number(left.race.round) - Number(right.race.round)
    })

  const best = ranked[0]
  if (!best || best.score <= 0) {
    return {
      season,
      localRound,
      externalRound: localRound,
      localGrandPrixName,
      externalRaceName: null,
      shifted: false,
    }
  }

  const externalRound = Number(best.race.round)

  return {
    season,
    localRound,
    externalRound,
    localGrandPrixName,
    externalRaceName: best.race.raceName,
    shifted: externalRound !== localRound,
  }
}

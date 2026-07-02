import { and, asc, eq, inArray } from "drizzle-orm"
import { parseDurationToMs, isDnf } from "@/lib/analytics/lap-time-parser"
import { resolveSessionId } from "@/lib/analytics/session-resolver"
import { getDb } from "@/lib/db/client"
import { getFantasyContext, getFantasyEntry, getFantasyProfileBySessionKey } from "@/lib/db/fantasy-core"
import { getFantasyLineupState } from "@/lib/db/fantasy-draft"
import {
  drivers,
  fantasyPredictions,
  fantasyProfiles,
  fantasyRoundEntries,
  fantasyRoundScores,
  fantasyScoreItems,
  pitStops,
  raceControlMessages,
  sessionResults,
  teams,
} from "@/lib/db/schema"

type ScoreBlock = "driver" | "team" | "engineer" | "prediction"

interface SessionDriverResultRow {
  resultId: number
  driverId: number
  driverCode: string
  driverName: string
  teamId: number
  teamName: string
  position: number
  status: string
  points: number
  q3Time: string | null
  gridPosition: number | null
  fastestLapRank: number | null
}

interface PitStopRow {
  id: number
  driverId: number
  teamId: number
  lap: number
  durationMs: number | null
}

interface ScoreItemInput {
  scoreBlock: ScoreBlock
  scoreType: string
  points: number
  assetId: number | null
  sourceTable: string
  sourceRecordId: number | null
  metaJson?: Record<string, unknown> | null
}

const QUALIFYING_POINTS = new Map([
  [1, 10],
  [2, 8],
  [3, 6],
  [4, 5],
  [5, 4],
  [6, 3],
  [7, 2],
  [8, 2],
  [9, 1],
  [10, 1],
])

const SPRINT_POINTS = new Map([
  [1, 8],
  [2, 7],
  [3, 6],
  [4, 5],
  [5, 4],
  [6, 3],
  [7, 2],
  [8, 1],
])

const RACE_POINTS = new Map([
  [1, 25],
  [2, 18],
  [3, 15],
  [4, 12],
  [5, 10],
  [6, 8],
  [7, 6],
  [8, 4],
  [9, 2],
  [10, 1],
])

function addItem(items: ScoreItemInput[], item: ScoreItemInput | null) {
  if (!item || item.points === 0) {
    return
  }

  items.push(item)
}

function driverSessionBasePoints(position: number, pointsMap: Map<number, number>): number {
  return pointsMap.get(position) ?? 0
}

function isDsqLike(status: string): boolean {
  const lower = status.toLowerCase()
  return lower.includes("dsq") || lower.includes("disqual") || lower.includes("dns")
}

function isClassified(status: string): boolean {
  return !isDnf(status) || status.toLowerCase() === "finished" || status.toLowerCase() === "lapped"
}

function determineSafetyCarBand(events: Array<{ messageType: string; messageText: string }>): string {
  const deployments = events.filter(
    (event) => event.messageType === "SafetyCar" && event.messageText.toUpperCase().includes("DEPLOYED"),
  ).length

  if (deployments === 0) return "0"
  if (deployments <= 2) return "1-2"
  return "3+"
}

async function getSessionResultsMap(sessionId: number | null): Promise<Map<number, SessionDriverResultRow>> {
  const db = getDb()

  if (!db || !sessionId) {
    return new Map()
  }

  const rows = await db
    .select({
      resultId: sessionResults.id,
      driverId: sessionResults.driverId,
      driverCode: drivers.code,
      driverName: drivers.fullName,
      teamId: teams.id,
      teamName: teams.name,
      position: sessionResults.position,
      status: sessionResults.status,
      points: sessionResults.points,
      q3Time: sessionResults.q3Time,
      gridPosition: sessionResults.gridPosition,
      fastestLapRank: sessionResults.fastestLapRank,
    })
    .from(sessionResults)
    .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(eq(sessionResults.sessionId, sessionId))

  return new Map(rows.map((row) => [row.driverId, row]))
}

async function getRacePitStops(sessionId: number | null): Promise<PitStopRow[]> {
  const db = getDb()

  if (!db || !sessionId) {
    return []
  }

  const rows = await db
    .select({
      id: pitStops.id,
      driverId: pitStops.driverId,
      teamId: teams.id,
      lap: pitStops.lap,
      duration: pitStops.duration,
    })
    .from(pitStops)
    .innerJoin(drivers, eq(pitStops.driverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(eq(pitStops.sessionId, sessionId))
    .orderBy(asc(pitStops.lap), asc(pitStops.stopNumber))

  return rows.map((row) => ({
    id: row.id,
    driverId: row.driverId,
    teamId: row.teamId,
    lap: row.lap,
    durationMs: parseDurationToMs(row.duration),
  }))
}

async function getRaceControlEvents(sessionId: number | null) {
  const db = getDb()

  if (!db || !sessionId) {
    return []
  }

  return db
    .select({
      id: raceControlMessages.id,
      lap: raceControlMessages.lap,
      flag: raceControlMessages.flag,
      messageType: raceControlMessages.messageType,
      messageText: raceControlMessages.messageText,
    })
    .from(raceControlMessages)
    .where(eq(raceControlMessages.sessionId, sessionId))
    .orderBy(asc(raceControlMessages.occurredAtUtc))
}

async function getTeamDriverIds(teamId: number): Promise<number[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const rows = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(eq(drivers.teamId, teamId))
    .orderBy(asc(drivers.fullName))

  return rows.map((row) => row.id)
}

function getTeammateResult(results: Map<number, SessionDriverResultRow>, driverId: number, teamId: number): SessionDriverResultRow | null {
  for (const row of results.values()) {
    if (row.teamId === teamId && row.driverId !== driverId) {
      return row
    }
  }

  return null
}

function calculateDriverItems(
  lineupAssetId: number,
  driverId: number,
  teamId: number,
  qualifying: Map<number, SessionDriverResultRow>,
  sprint: Map<number, SessionDriverResultRow>,
  race: Map<number, SessionDriverResultRow>,
): ScoreItemInput[] {
  const items: ScoreItemInput[] = []
  const qualiRow = qualifying.get(driverId)
  const sprintRow = sprint.get(driverId)
  const raceRow = race.get(driverId)
  const qualiTeammate = getTeammateResult(qualifying, driverId, teamId)
  const sprintTeammate = getTeammateResult(sprint, driverId, teamId)
  const raceTeammate = getTeammateResult(race, driverId, teamId)

  if (qualiRow) {
    if (isDsqLike(qualiRow.status)) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "qualifying_dsq",
        points: -5,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: qualiRow.resultId,
      })
    } else {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "qualifying_position",
        points: driverSessionBasePoints(qualiRow.position, QUALIFYING_POINTS),
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: qualiRow.resultId,
      })
    }

    if (qualiTeammate && qualiRow.position > 0 && qualiTeammate.position > 0 && qualiRow.position < qualiTeammate.position) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "teammate_quali_beat",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: qualiRow.resultId,
      })
    }
  }

  if (sprintRow) {
    if (isDnf(sprintRow.status)) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "sprint_dnf",
        points: -5,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRow.resultId,
      })
    } else {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "sprint_position",
        points: driverSessionBasePoints(sprintRow.position, SPRINT_POINTS),
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRow.resultId,
      })

      const sprintGain = (sprintRow.gridPosition ?? sprintRow.position) - sprintRow.position
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "sprint_overtakes",
        points: Math.max(-4, Math.min(4, sprintGain)),
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRow.resultId,
        metaJson: { gain: sprintGain },
      })
    }

    if (sprintTeammate && sprintRow.position > 0 && sprintTeammate.position > 0 && sprintRow.position < sprintTeammate.position) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "teammate_sprint_beat",
        points: 2,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRow.resultId,
      })
    }
  }

  if (raceRow) {
    if (isDnf(raceRow.status)) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "race_dnf",
        points: -10,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRow.resultId,
      })
    } else {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "race_position",
        points: driverSessionBasePoints(raceRow.position, RACE_POINTS),
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRow.resultId,
      })

      const raceGain = (raceRow.gridPosition ?? raceRow.position) - raceRow.position
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "race_overtakes",
        points: Math.max(-6, Math.min(6, raceGain)),
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRow.resultId,
        metaJson: { gain: raceGain },
      })

      if (raceRow.fastestLapRank === 1) {
        addItem(items, {
          scoreBlock: "driver",
          scoreType: "fastest_lap",
          points: 5,
          assetId: lineupAssetId,
          sourceTable: "session_results",
          sourceRecordId: raceRow.resultId,
        })
      }
    }

    if (raceTeammate && raceRow.position > 0 && raceTeammate.position > 0 && raceRow.position < raceTeammate.position) {
      addItem(items, {
        scoreBlock: "driver",
        scoreType: "teammate_race_beat",
        points: 4,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRow.resultId,
      })
    }
  }

  return items
}

function calculateTeamItems(
  lineupAssetId: number,
  teamDriverIds: number[],
  qualifying: Map<number, SessionDriverResultRow>,
  sprint: Map<number, SessionDriverResultRow>,
  race: Map<number, SessionDriverResultRow>,
  teamPitStops: PitStopRow[],
): ScoreItemInput[] {
  const items: ScoreItemInput[] = []
  const qualiRows = teamDriverIds.map((driverId) => qualifying.get(driverId)).filter((row): row is SessionDriverResultRow => Boolean(row))
  const sprintRows = teamDriverIds.map((driverId) => sprint.get(driverId)).filter((row): row is SessionDriverResultRow => Boolean(row))
  const raceRows = teamDriverIds.map((driverId) => race.get(driverId)).filter((row): row is SessionDriverResultRow => Boolean(row))

  const q3Cars = qualiRows.filter((row) => row.position <= 10 || row.q3Time)
  if (q3Cars.length === 1) {
    addItem(items, {
      scoreBlock: "team",
      scoreType: "q3_one_car",
      points: 2,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: q3Cars[0].resultId,
    })
  } else if (q3Cars.length >= 2) {
    addItem(items, {
      scoreBlock: "team",
      scoreType: "q3_both_cars",
      points: 4,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: q3Cars[0].resultId,
    })
  }

  if (qualiRows.some((row) => isDsqLike(row.status))) {
    addItem(items, {
      scoreBlock: "team",
      scoreType: "qualifying_dsq",
      points: -3,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: qualiRows.find((row) => isDsqLike(row.status))?.resultId ?? null,
    })
  }

  if (sprintRows.length >= 2) {
    if (sprintRows.every((row) => isClassified(row.status))) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "sprint_both_finish",
        points: 2,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRows[0].resultId,
      })
    }

    if (sprintRows.every((row) => row.position <= 8)) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "sprint_both_top8",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRows[0].resultId,
      })
    }

    const sprintDnfs = sprintRows.filter((row) => isDnf(row.status)).length
    if (sprintDnfs === 1) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "sprint_dnf",
        points: -3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRows.find((row) => isDnf(row.status))?.resultId ?? null,
      })
    } else if (sprintDnfs >= 2) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "sprint_dnf",
        points: -6,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: sprintRows[0].resultId,
        metaJson: { dnfs: sprintDnfs },
      })
    }
  }

  if (raceRows.length >= 2) {
    if (raceRows.every((row) => isClassified(row.status))) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_both_finish",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0].resultId,
      })
    }

    if (raceRows.every((row) => row.position <= 10)) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_both_points",
        points: 5,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0].resultId,
      })
    }

    const podiums = raceRows.filter((row) => row.position <= 3).length
    if (podiums === 1) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_podium",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => row.position <= 3)?.resultId ?? null,
      })
    } else if (podiums >= 2) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_podium",
        points: 6,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => row.position <= 3)?.resultId ?? null,
        metaJson: { count: podiums },
      })
    }

    if (raceRows.some((row) => row.position === 1)) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_win",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => row.position === 1)?.resultId ?? null,
      })
    }

    const dnfs = raceRows.filter((row) => isDnf(row.status)).length
    if (dnfs === 1) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_dnf",
        points: -4,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => isDnf(row.status))?.resultId ?? null,
      })
    } else if (dnfs >= 2) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "race_dnf",
        points: -8,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0].resultId,
        metaJson: { dnfs },
      })
    }
  }

  const fastestTeamPit = teamPitStops
    .map((row) => row.durationMs)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)[0]

  if (typeof fastestTeamPit === "number") {
    const pitBonus = fastestTeamPit < 2200 ? 4 : fastestTeamPit < 2500 ? 2 : fastestTeamPit < 3000 ? 1 : 0
    addItem(items, {
      scoreBlock: "team",
      scoreType: "pit_crew_fast",
      points: pitBonus,
      assetId: lineupAssetId,
      sourceTable: "pit_stops",
      sourceRecordId: teamPitStops.find((row) => row.durationMs === fastestTeamPit)?.id ?? null,
      metaJson: { durationMs: fastestTeamPit },
    })

    if (fastestTeamPit > 5000) {
      addItem(items, {
        scoreBlock: "team",
        scoreType: "pit_crew_slow",
        points: -3,
        assetId: lineupAssetId,
        sourceTable: "pit_stops",
        sourceRecordId: teamPitStops.find((row) => row.durationMs === fastestTeamPit)?.id ?? null,
        metaJson: { durationMs: fastestTeamPit },
      })
    }
  }

  return items
}

function calculateEngineerItems(
  lineupAssetId: number,
  teamDriverIds: number[],
  qualifying: Map<number, SessionDriverResultRow>,
  race: Map<number, SessionDriverResultRow>,
  teamPitStops: PitStopRow[],
  allPitStops: PitStopRow[],
  raceControl: Array<{ id: number; lap: number; messageType: string; messageText: string; flag: string }>,
): ScoreItemInput[] {
  const items: ScoreItemInput[] = []
  const qualiRows = teamDriverIds.map((driverId) => qualifying.get(driverId)).filter((row): row is SessionDriverResultRow => Boolean(row))
  const raceRows = teamDriverIds.map((driverId) => race.get(driverId)).filter((row): row is SessionDriverResultRow => Boolean(row))

  const topFiveCars = qualiRows.filter((row) => row.position > 0 && row.position <= 5)
  if (topFiveCars.length === 1) {
    addItem(items, {
      scoreBlock: "engineer",
      scoreType: "strategy_quali_execution",
      points: 2,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: topFiveCars[0].resultId,
      metaJson: { topFiveCars: 1 },
    })
  } else if (topFiveCars.length >= 2) {
    addItem(items, {
      scoreBlock: "engineer",
      scoreType: "strategy_quali_execution",
      points: 4,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: topFiveCars[0].resultId,
      metaJson: { topFiveCars: topFiveCars.length },
    })
  }

  if (raceRows.length > 0) {
    const totalGain = raceRows.reduce((sum, row) => {
      const grid = row.gridPosition ?? row.position
      return sum + (grid - row.position)
    }, 0)

    addItem(items, {
      scoreBlock: "engineer",
      scoreType: "strategy_race_gain",
      points: Math.max(-4, Math.min(6, totalGain)),
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: raceRows[0]?.resultId ?? null,
      metaJson: { totalGain },
    })

    const carsInPoints = raceRows.filter((row) => row.position > 0 && row.position <= 10).length
    if (carsInPoints === 2) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_points_conversion",
        points: 4,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0]?.resultId ?? null,
      })
    } else if (carsInPoints === 1 && totalGain >= 3) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_points_conversion",
        points: 2,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => row.position > 0 && row.position <= 10)?.resultId ?? null,
      })
    }

    if (totalGain < 0 && raceRows.every((row) => !isDnf(row.status))) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_position_lost",
        points: -3,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0]?.resultId ?? null,
        metaJson: { totalGain },
      })
    }

    const dnfs = raceRows.filter((row) => isDnf(row.status)).length
    if (dnfs === 1) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_dnf_penalty",
        points: -2,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows.find((row) => isDnf(row.status))?.resultId ?? null,
        metaJson: { dnfs: 1 },
      })
    } else if (dnfs >= 2) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_dnf_penalty",
        points: -4,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0]?.resultId ?? null,
        metaJson: { dnfs },
      })
    }

    const hasPenalty = raceControl.some(
      (event) =>
        (event.messageType === "Penalty" || event.messageText.toUpperCase().includes("PENALTY")) &&
        teamDriverIds.some((driverId) => {
          const row = race.get(driverId)
          return row && event.messageText.includes(row.driverCode)
        }),
    )

    if (!hasPenalty && raceRows.every((row) => isClassified(row.status))) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_clean_race",
        points: 2,
        assetId: lineupAssetId,
        sourceTable: "session_results",
        sourceRecordId: raceRows[0]?.resultId ?? null,
      })
    }
  }

  const rivalPitLaps = allPitStops
    .filter((stop) => !teamDriverIds.includes(stop.driverId))
    .map((stop) => stop.lap)

  for (const teamStop of teamPitStops) {
    const driverRow = race.get(teamStop.driverId)
    if (!driverRow || isDnf(driverRow.status)) continue

    const grid = driverRow.gridPosition ?? driverRow.position
    const gained = grid - driverRow.position
    if (gained < 2) continue

    const nearbyRivalPit = rivalPitLaps.some((lap) => Math.abs(lap - teamStop.lap) <= 2)
    if (nearbyRivalPit) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_undercut_overcut",
        points: 3,
        assetId: lineupAssetId,
        sourceTable: "pit_stops",
        sourceRecordId: teamStop.id,
        metaJson: { driverId: teamStop.driverId, pitLap: teamStop.lap, gained },
      })
      break
    }
  }

  const safetyCarLaps = raceControl
    .filter((event) => event.messageType === "SafetyCar" && event.messageText.toUpperCase().includes("DEPLOYED"))
    .map((event) => event.lap)

  if (raceRows.length > 0 && safetyCarLaps.length > 0) {
    const teamGain = raceRows.reduce((sum, row) => {
      const grid = row.gridPosition ?? row.position
      return sum + (grid - row.position)
    }, 0)

    if (teamPitStops.some((stop) => safetyCarLaps.some((lap) => Math.abs(lap - stop.lap) <= 1)) && teamGain > 0) {
      addItem(items, {
        scoreBlock: "engineer",
        scoreType: "strategy_sc_window",
        points: 4,
        assetId: lineupAssetId,
        sourceTable: "race_control_messages",
        sourceRecordId: raceControl.find((event) => safetyCarLaps.includes(event.lap))?.id ?? null,
        metaJson: { teamGain },
      })
    }
  }

  return items
}

function calculatePredictionItems(
  lineupAssetId: number | null,
  predictions: typeof fantasyPredictions.$inferSelect | null,
  qualifying: Map<number, SessionDriverResultRow>,
  race: Map<number, SessionDriverResultRow>,
  allPitStops: PitStopRow[],
  raceControl: Array<{ id: number; lap: number; messageType: string; messageText: string; flag: string }>,
): ScoreItemInput[] {
  if (!predictions || (qualifying.size === 0 && race.size === 0)) {
    return []
  }

  const items: ScoreItemInput[] = []
  const actualPoleDriverId = Array.from(qualifying.values()).find((row) => row.position === 1)?.driverId ?? null
  const actualWinnerDriverId = Array.from(race.values()).find((row) => row.position === 1)?.driverId ?? null
  const actualPodium = Array.from(race.values())
    .filter((row) => row.position >= 1 && row.position <= 3)
    .sort((left, right) => left.position - right.position)
    .map((row) => row.driverId)
  const actualFastestLapDriverId = Array.from(race.values()).find((row) => row.fastestLapRank === 1)?.driverId ?? null

  const fastestPitStop = allPitStops
    .filter((row) => typeof row.durationMs === "number")
    .sort((left, right) => (left.durationMs ?? Number.MAX_SAFE_INTEGER) - (right.durationMs ?? Number.MAX_SAFE_INTEGER))[0]
  const safetyCarBand = determineSafetyCarBand(raceControl)
  const hasRedFlag = raceControl.some(
    (event) => event.flag.toUpperCase().includes("RED") || event.messageText.toUpperCase().includes("RED FLAG"),
  )

  if (predictions.poleDriverId && predictions.poleDriverId === actualPoleDriverId) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_pole",
      points: 8,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(qualifying.values()).find((row) => row.driverId === actualPoleDriverId)?.resultId ?? null,
    })
  }

  if (predictions.raceWinnerDriverId && predictions.raceWinnerDriverId === actualWinnerDriverId) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_winner",
      points: 10,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(race.values()).find((row) => row.driverId === actualWinnerDriverId)?.resultId ?? null,
    })
  }

  const predictedPodium = [predictions.raceWinnerDriverId, predictions.podiumP2DriverId, predictions.podiumP3DriverId]
  predictedPodium.forEach((driverId, index) => {
    const actualDriverId = actualPodium[index]

    if (!driverId) {
      return
    }

    addItem(items, {
      scoreBlock: "prediction",
      scoreType: index === 0 ? "predicted_podium_p1" : index === 1 ? "predicted_podium_p2" : "predicted_podium_p3",
      points: driverId === actualDriverId ? 6 : actualPodium.includes(driverId) ? 3 : 0,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(race.values()).find((row) => row.driverId === (driverId === actualDriverId ? actualDriverId : driverId))?.resultId ?? null,
    })
  })

  if (predictions.fastestLapDriverId && predictions.fastestLapDriverId === actualFastestLapDriverId) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_fastest_lap",
      points: 5,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(race.values()).find((row) => row.driverId === actualFastestLapDriverId)?.resultId ?? null,
    })
  }

  if (predictions.fastestPitTeamId && fastestPitStop && predictions.fastestPitTeamId === fastestPitStop.teamId) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_fastest_pit",
      points: 4,
      assetId: lineupAssetId,
      sourceTable: "pit_stops",
      sourceRecordId: fastestPitStop.id,
    })
  }

  if (predictions.safetyCarBand && predictions.safetyCarBand === safetyCarBand) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_safety_car_band",
      points: 4,
      assetId: lineupAssetId,
      sourceTable: "race_control_messages",
      sourceRecordId: raceControl[0]?.id ?? null,
      metaJson: { actualBand: safetyCarBand },
    })
  }

  if (predictions.hasRedFlag === hasRedFlag) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "predicted_red_flag",
      points: 3,
      assetId: lineupAssetId,
      sourceTable: "race_control_messages",
      sourceRecordId: raceControl.find((event) => event.flag.toUpperCase().includes("RED"))?.id ?? null,
      metaJson: { actual: hasRedFlag },
    })
  }

  if (predictions.poleDriverId === actualPoleDriverId && predictions.raceWinnerDriverId === actualWinnerDriverId && predictions.fastestLapDriverId === actualFastestLapDriverId) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "prediction_combo_pole_win_fastest_lap",
      points: 5,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(race.values()).find((row) => row.driverId === actualWinnerDriverId)?.resultId ?? null,
    })
  }

  if (predictedPodium.length === 3 && predictedPodium.every((driverId, index) => driverId === actualPodium[index])) {
    addItem(items, {
      scoreBlock: "prediction",
      scoreType: "prediction_combo_exact_podium",
      points: 8,
      assetId: lineupAssetId,
      sourceTable: "session_results",
      sourceRecordId: Array.from(race.values()).find((row) => row.position === 1)?.resultId ?? null,
    })
  }

  return items
}

function sumPoints(items: ScoreItemInput[], block: ScoreBlock): number {
  return items.filter((item) => item.scoreBlock === block).reduce((sum, item) => sum + item.points, 0)
}

async function persistEntryScore(
  entryId: number,
  seasonId: number,
  weekendId: number,
  items: ScoreItemInput[],
  isOfficial: boolean,
) {
  const db = getDb()

  if (!db) {
    return null
  }

  const driversScore = sumPoints(items, "driver")
  const teamScore = sumPoints(items, "team")
  const engineerScore = sumPoints(items, "engineer")
  const predictionsScore = sumPoints(items, "prediction")
  const totalScore = driversScore + teamScore + engineerScore + predictionsScore

  const [roundScore] = await db
    .insert(fantasyRoundScores)
    .values({
      entryId,
      seasonId,
      weekendId,
      driversScore,
      teamScore,
      engineerScore,
      predictionsScore,
      totalScore,
      isOfficial,
      calculatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fantasyRoundScores.entryId,
      set: {
        driversScore,
        teamScore,
        engineerScore,
        predictionsScore,
        totalScore,
        isOfficial,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()

  await db.delete(fantasyScoreItems).where(eq(fantasyScoreItems.roundScoreId, roundScore.id))

  if (items.length > 0) {
    await db.insert(fantasyScoreItems).values(
      items.map((item) => ({
        roundScoreId: roundScore.id,
        assetId: item.assetId,
        scoreBlock: item.scoreBlock,
        scoreType: item.scoreType,
        points: item.points,
        sourceTable: item.sourceTable,
        sourceRecordId: item.sourceRecordId,
        metaJson: item.metaJson ?? null,
      })),
    )
  }

  return {
    roundScoreId: roundScore.id,
    driversScore,
    teamScore,
    engineerScore,
    predictionsScore,
    totalScore,
    itemsCount: items.length,
  }
}

async function calculateEntryScore(entry: typeof fantasyRoundEntries.$inferSelect, season: number, round: number) {
  const lineup = await getFantasyLineupState(entry.id, season, round)
  const db = getDb()

  if (!db || !lineup.driver1 || !lineup.driver2 || !lineup.team || !lineup.engineer) {
    return null
  }

  const driver1 = lineup.driver1
  const driver2 = lineup.driver2
  const team = lineup.team
  const engineer = lineup.engineer

  const [qualifyingSessionId, sprintSessionId, raceSessionId, predictions] = await Promise.all([
    resolveSessionId(season, round, "Q"),
    resolveSessionId(season, round, "S"),
    resolveSessionId(season, round, "R"),
    db
      .select()
      .from(fantasyPredictions)
      .where(eq(fantasyPredictions.entryId, entry.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  const [qualifyingResults, sprintResults, raceResults, racePitRows, raceControl, teamDriverIds] = await Promise.all([
    getSessionResultsMap(qualifyingSessionId),
    getSessionResultsMap(sprintSessionId),
    getSessionResultsMap(raceSessionId),
    getRacePitStops(raceSessionId),
    getRaceControlEvents(raceSessionId),
    getTeamDriverIds(team.entityId ?? 0),
  ])

  const driver1Items = calculateDriverItems(
    driver1.assetId,
    driver1.entityId ?? 0,
    qualifyingResults.get(driver1.entityId ?? 0)?.teamId ?? 0,
    qualifyingResults,
    sprintResults,
    raceResults,
  )

  const driver2Items = calculateDriverItems(
    driver2.assetId,
    driver2.entityId ?? 0,
    qualifyingResults.get(driver2.entityId ?? 0)?.teamId ?? 0,
    qualifyingResults,
    sprintResults,
    raceResults,
  )

  const teamItems = calculateTeamItems(
    team.assetId,
    teamDriverIds,
    qualifyingResults,
    sprintResults,
    raceResults,
    racePitRows.filter((row) => row.teamId === team.entityId),
  )

  const engineerTeamId = engineer.linkedTeamId ?? 0
  const engineerTeamDriverIds = await getTeamDriverIds(engineerTeamId)
  const engineerItems = calculateEngineerItems(
    engineer.assetId,
    engineerTeamDriverIds,
    qualifyingResults,
    raceResults,
    racePitRows.filter((row) => row.teamId === engineerTeamId),
    racePitRows,
    raceControl,
  )

  const predictionItems = calculatePredictionItems(
    null,
    predictions,
    qualifyingResults,
    raceResults,
    racePitRows,
    raceControl,
  )

  const isOfficial = Boolean(raceSessionId && raceResults.size > 0)
  const persisted = await persistEntryScore(
    entry.id,
    entry.seasonId,
    entry.weekendId,
    [...driver1Items, ...driver2Items, ...teamItems, ...engineerItems, ...predictionItems],
    isOfficial,
  )

  return {
    entryId: entry.id,
    lineup,
    persisted,
  }
}

export async function scoreFantasyRound(
  season: number,
  round: number,
  sessionKey?: string,
) {
  const db = getDb()
  const context = await getFantasyContext(season, round)

  if (!db || !context) {
    return null
  }

  let entries: Array<typeof fantasyRoundEntries.$inferSelect> = []

  if (sessionKey) {
    const profile = await getFantasyProfileBySessionKey(sessionKey)

    if (!profile) {
      return null
    }

    const entry = await getFantasyEntry(profile.id, context.fantasySeasonId, context.weekendId)
    entries = entry && entry.status === "locked" ? [entry] : []
  } else {
    entries = await db
      .select()
      .from(fantasyRoundEntries)
      .where(
        and(
          eq(fantasyRoundEntries.seasonId, context.fantasySeasonId),
          eq(fantasyRoundEntries.weekendId, context.weekendId),
          eq(fantasyRoundEntries.status, "locked"),
        ),
      )
  }

  const scoredEntries = []

  for (const entry of entries) {
    const scored = await calculateEntryScore(entry, season, round)
    if (scored) {
      scoredEntries.push(scored)
    }
  }

  return {
    season,
    round,
    weekendId: context.weekendId,
    entriesScored: scoredEntries.length,
    results: scoredEntries.map((entry) => ({
      entryId: entry.entryId,
      totalScore: entry.persisted?.totalScore ?? 0,
      itemsCount: entry.persisted?.itemsCount ?? 0,
    })),
  }
}
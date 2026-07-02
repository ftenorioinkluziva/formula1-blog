import { asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, sessionResults, teams } from "@/lib/db/schema"

export interface SessionResultItem {
  position: number
  points: number
  status: string
  bestLapTime: string | null
  gapToLeader: string | null
  driver: {
    id: number
    number: number
    code: string
    fullName: string
    teamName: string
    country: string
  }
}

export async function getSessionResults(sessionId: number): Promise<SessionResultItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const rows = await db
    .select({
      result: sessionResults,
      driver: drivers,
      team: teams,
    })
    .from(sessionResults)
    .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .where(eq(sessionResults.sessionId, sessionId))
    .orderBy(asc(sessionResults.position))

  return rows.map((row) => ({
    position: row.result.position,
    points: row.result.points,
    status: row.result.status,
    bestLapTime: row.result.bestLapTime,
    gapToLeader: row.result.gapToLeader,
    driver: {
      id: row.driver.id,
      number: row.driver.driverNumber,
      code: row.driver.code,
      fullName: row.driver.fullName,
      teamName: row.team.name,
      country: row.driver.country,
    },
  }))
}

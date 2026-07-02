import { asc, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, teams } from "@/lib/db/schema"

export interface DriverListItem {
  id: number
  name: string
  shortName: string
  number: number
  team: string
  teamColor: string
  nationality: string
  flag: string
  points: number
  position: number
  wins: number
  podiums: number
  poles: number
  championships: number
  dob: string
  pob: string
  gpEntered: number
  careerPoints: string
  bestFinish: string
  bestGrid: string
  dnfs: number
  imageUrl: string | null
}

export async function getDriversList(): Promise<DriverListItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const rows = await db
    .select({
      driver: drivers,
      team: teams,
    })
    .from(drivers)
    .innerJoin(teams, eq(drivers.teamId, teams.id))
    .orderBy(desc(drivers.points), asc(drivers.position), asc(drivers.fullName))

  return rows.map((row) => ({
    id: row.driver.id,
    name: row.driver.fullName,
    shortName: row.driver.shortName,
    number: row.driver.driverNumber,
    team: row.team.name,
    teamColor: row.team.color,
    nationality: row.driver.nationality,
    flag: row.driver.flag,
    points: row.driver.points,
    position: row.driver.position,
    wins: row.driver.wins,
    podiums: row.driver.podiums,
    poles: row.driver.poles,
    championships: row.driver.championships,
    dob: row.driver.dob,
    pob: row.driver.pob,
    gpEntered: row.driver.gpEntered,
    careerPoints: row.driver.careerPoints,
    bestFinish: row.driver.bestFinish,
    bestGrid: row.driver.bestGrid,
    dnfs: row.driver.dnfs,
    imageUrl: row.driver.imageUrl,
  }))
}

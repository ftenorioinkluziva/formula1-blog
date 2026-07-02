import { asc, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { drivers, teams } from "@/lib/db/schema"

export interface TeamListItem {
  id: number
  name: string
  color: string
  points: number
  position: number
  driver1: string
  driver2: string
  wins: number
  podiums: number
  base: string
  fullName: string
  teamChief: string
  technicalChief: string
  chassis: string
  powerUnit: string
  firstEntry: string
  championships: number
}

export async function getTeamsList(): Promise<TeamListItem[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  const rows = await db
    .select({
      team: teams,
      driverId: drivers.id,
      driverFullName: drivers.fullName,
      driverPosition: drivers.position,
    })
    .from(teams)
    .leftJoin(drivers, eq(drivers.teamId, teams.id))
    .orderBy(desc(teams.points), asc(teams.position), asc(teams.name), asc(drivers.position), asc(drivers.fullName))

  const grouped = new Map<number, TeamListItem>()

  for (const row of rows) {
    const existing = grouped.get(row.team.id)

    if (!existing) {
      grouped.set(row.team.id, {
        id: row.team.id,
        name: row.team.name,
        color: row.team.color,
        points: row.team.points,
        position: row.team.position,
        driver1: "—",
        driver2: "—",
        wins: row.team.wins,
        podiums: row.team.podiums,
        base: row.team.base,
        fullName: row.team.fullName,
        teamChief: row.team.teamChief,
        technicalChief: row.team.technicalChief,
        chassis: row.team.chassis,
        powerUnit: row.team.powerUnit,
        firstEntry: row.team.firstEntry,
        championships: row.team.championships,
      })
    }

    if (row.driverId && row.driverFullName) {
      const team = grouped.get(row.team.id)

      if (!team) {
        continue
      }

      const driverLabel = formatDriverName(row.driverFullName)

      if (team.driver1 === "—") {
        team.driver1 = driverLabel
      } else if (team.driver2 === "—") {
        team.driver2 = driverLabel
      }
    }
  }

  return Array.from(grouped.values())
}

function formatDriverName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)

  if (parts.length < 2) {
    return fullName
  }

  const firstInitial = parts[0]?.charAt(0).toUpperCase() ?? ""
  const lastName = parts[parts.length - 1] ?? ""

  return `${firstInitial}. ${lastName}`
}

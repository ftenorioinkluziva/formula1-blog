import type { Client } from "pg"
import { parseRaceStartUtc, raceCalendar } from "./race-calendar-data"
import { driverCareerStats, driverProfiles } from "./driver-profiles-data"
import { teamProfilesData } from "./team-profiles-data"
import { galleryImagesSeed, mediaGalleriesSeed, mediaPodcastsSeed } from "./media-data"
import { newsArticlesSeed } from "./news-data"
import type { CalendarRace, CalendarSession, SessionDay } from "./race-calendar-data"

const dayMap: Record<SessionDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

function extractCountry(location: string): string {
  const parts = location.split(",")
  return parts[parts.length - 1]?.trim() || "Unknown"
}

function parseSessionStart(race: CalendarRace, session: CalendarSession, season: number): Date {
  const raceStart = parseRaceStartUtc(race.date, race.time, season)
  const [timePart] = session.time.split(" ")
  const [hourLabel, minuteLabel] = timePart.split(":")

  const raceDay = raceStart.getUTCDay()
  const sessionDay = dayMap[session.day]
  const delta = sessionDay - raceDay
  const dayOffset = delta > 0 ? delta - 7 : delta

  return new Date(
    Date.UTC(
      raceStart.getUTCFullYear(),
      raceStart.getUTCMonth(),
      raceStart.getUTCDate() + dayOffset,
      Number(hourLabel),
      Number(minuteLabel),
      0,
      0,
    ),
  )
}

function parseSessionPart(sessionName: string): number | null {
  const match = sessionName.match(/^Practice\s+(\d+)$/)

  if (!match) {
    return null
  }

  return Number(match[1])
}

function getSessionDurationMs(sessionName: string): number {
  if (sessionName === "Race") {
    return 2 * 60 * 60 * 1000
  }

  return 60 * 60 * 1000
}

function parseSessionCode(sessionName: string): string {
  const normalized = sessionName.toLowerCase()

  if (normalized === "race") return "R"
  if (normalized === "qualifying") return "Q"
  if (normalized === "sprint qualifying") return "SQ"
  if (normalized === "sprint") return "SPR"

  const practiceMatch = normalized.match(/^practice\s+(\d+)$/)
  if (practiceMatch) {
    return `P${practiceMatch[1]}`
  }

  return sessionName.toUpperCase().replace(/\s+/g, "_")
}

function buildBestLapTime(position: number): string {
  const minute = 1
  const second = 28 + Math.floor((position - 1) / 6)
  const milli = 100 + ((position - 1) * 37) % 900
  return `${minute}:${String(second).padStart(2, "0")}.${String(milli).padStart(3, "0")}`
}

function buildGapToLeader(position: number): string {
  if (position === 1) {
    return "0.000"
  }

  const gap = ((position - 1) * 2.137).toFixed(3)
  return `+${gap}s`
}

export async function clearSeedTables(client: Client, season: number): Promise<void> {
  await client.query("DELETE FROM race_weekends WHERE season = $1", [season])
  await client.query("DELETE FROM drivers")
  await client.query("DELETE FROM teams")
  await client.query("DELETE FROM media_galleries")
  await client.query("DELETE FROM media_podcasts")
  await client.query("DELETE FROM news_articles")
}

export async function seedTeams(client: Client): Promise<Map<string, number>> {
  const teamByName = new Map<string, number>()

  for (const team of teamProfilesData) {
    const insert = await client.query(
      `
        INSERT INTO teams (
          name,
          color,
          points,
          position,
          wins,
          podiums,
          base,
          full_name,
          team_chief,
          technical_chief,
          chassis,
          power_unit,
          first_entry,
          championships
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id
      `,
      [
        team.name,
        team.color,
        team.points,
        team.position,
        team.wins,
        team.podiums,
        team.base,
        team.fullName,
        team.teamChief,
        team.technicalChief,
        team.chassis,
        team.powerUnit,
        team.firstEntry,
        team.championships,
      ],
    )

    teamByName.set(team.name, insert.rows[0]?.id as number)
  }

  return teamByName
}

export async function seedMedia(client: Client): Promise<void> {
  for (let index = 0; index < mediaGalleriesSeed.length; index += 1) {
    const gallery = mediaGalleriesSeed[index]

    const result = await client.query(
      `
        INSERT INTO media_galleries (
          title,
          image_count,
          category,
          sort_order
        ) VALUES ($1,$2,$3,$4)
        RETURNING id
      `,
      [gallery.title, gallery.imageCount, gallery.category, index],
    )

    const galleryId = result.rows[0].id as number
    const images = galleryImagesSeed[gallery.title] ?? []

    for (let imgIndex = 0; imgIndex < images.length; imgIndex += 1) {
      const img = images[imgIndex]
      await client.query(
        `
          INSERT INTO gallery_images (gallery_id, image_url, caption, sort_order)
          VALUES ($1, $2, $3, $4)
        `,
        [galleryId, img.imageUrl, img.caption ?? null, imgIndex],
      )
    }
  }

  for (let index = 0; index < mediaPodcastsSeed.length; index += 1) {
    const podcast = mediaPodcastsSeed[index]

    await client.query(
      `
        INSERT INTO media_podcasts (
          title,
          episode,
          duration,
          guest,
          sort_order
        ) VALUES ($1,$2,$3,$4,$5)
      `,
      [podcast.title, podcast.episode, podcast.duration, podcast.guest, index],
    )
  }
}

export async function seedNews(client: Client): Promise<void> {
  for (let index = 0; index < newsArticlesSeed.length; index += 1) {
    const article = newsArticlesSeed[index]

    await client.query(
      `
        INSERT INTO news_articles (
          title,
          excerpt,
          category,
          read_time,
          published_date,
          comments,
          author,
          body,
          is_featured,
          sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        article.title,
        article.excerpt,
        article.category,
        article.readTime,
        article.publishedDate,
        article.comments,
        article.author,
        article.body,
        article.isFeatured,
        index,
      ],
    )
  }
}

export async function seedDrivers(client: Client): Promise<Map<string, number>> {
  const teamRows = await client.query<{ id: number; name: string }>(
    `
      SELECT id, name
      FROM teams
    `,
  )

  const teamByName = new Map<string, number>()

  for (const team of teamRows.rows) {
    teamByName.set(team.name, team.id)
  }

  const driverByCode = new Map<string, number>()

  for (const driver of driverProfiles) {
    const career = driverCareerStats[driver.name]

    if (!career) {
      continue
    }

    const teamId = teamByName.get(driver.team)

    if (!teamId) {
      continue
    }

    const driverInsert = await client.query(
      `
        INSERT INTO drivers (
          driver_number,
          short_name,
          code,
          full_name,
          team_id,
          nationality,
          flag,
          country,
          points,
          position,
          wins,
          podiums,
          poles,
          championships,
          dob,
          pob,
          gp_entered,
          career_points,
          best_finish,
          best_grid,
          dnfs
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING id
      `,
      [
        driver.number,
        driver.shortName,
        driver.shortName,
        driver.name,
        teamId,
        driver.nationality,
        driver.flag,
        driver.nationality,
        driver.points,
        driver.position,
        driver.wins,
        driver.podiums,
        driver.poles,
        driver.championships,
        driver.dob,
        driver.pob,
        career.gpEntered,
        career.careerPoints,
        career.bestFinish,
        career.bestGrid,
        career.dnfs,
      ],
    )

    driverByCode.set(driver.shortName, driverInsert.rows[0]?.id as number)
  }

  return driverByCode
}

export interface SeedRaceSessionsInput {
  season: number
  pointsTable: number[]
  driverByCode: Map<string, number>
}

export async function seedRaceSessions(client: Client, input: SeedRaceSessionsInput): Promise<number> {
  let inserted = 0

  for (const race of raceCalendar) {
    const weekendInsert = await client.query(
      `
        INSERT INTO race_weekends (
          season,
          round,
          grand_prix_name,
          circuit,
          country,
          location
        ) VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id
      `,
      [
        input.season,
        race.round,
        race.name,
        race.circuit,
        extractCountry(race.location),
        race.location,
      ],
    )

    const weekendId = weekendInsert.rows[0]?.id as number
    const isSprintWeekend = race.sessions.some((session) => session.session === "Sprint")

    for (const session of race.sessions) {
      const start = parseSessionStart(race, session, input.season)
      const end = new Date(start.getTime() + getSessionDurationMs(session.session))

      const sessionInsert = await client.query(
        `
          INSERT INTO race_sessions (
            weekend_id,
            session_type,
            session_code,
            part,
            status,
            source,
            is_sprint_weekend,
            start_time_utc,
            end_time_utc
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id
        `,
        [
          weekendId,
          session.session,
          parseSessionCode(session.session),
          parseSessionPart(session.session),
          "scheduled",
          "seed",
          isSprintWeekend,
          start,
          end,
        ],
      )

      const sessionId = sessionInsert.rows[0]?.id as number

      await client.query(
        `
          INSERT INTO session_status_events (
            session_id,
            status,
            status_reason,
            occurred_at_utc
          ) VALUES ($1,$2,$3,$4)
        `,
        [sessionId, "scheduled", "seed initialization", start],
      )

      if (session.session === "Race") {
        for (let index = 0; index < driverProfiles.length; index += 1) {
          const driver = driverProfiles[index]
          const position = index + 1
          const points = input.pointsTable[index] ?? 0
          const driverId = input.driverByCode.get(driver.shortName)

          if (!driverId) {
            continue
          }

          await client.query(
            `
              INSERT INTO session_results (
                session_id,
                driver_id,
                position,
                best_lap_time,
                gap_to_leader,
                points,
                status
              ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            `,
            [
              sessionId,
              driverId,
              position,
              buildBestLapTime(position),
              buildGapToLeader(position),
              points,
              "finished",
            ],
          )
        }
      }

      inserted += 1
    }
  }

  return inserted
}

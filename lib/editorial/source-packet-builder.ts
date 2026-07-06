import { and, asc, desc, eq, lte, ne, sql } from "drizzle-orm"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { getDb } from "@/lib/db/client"
import {
  editorialAssignments,
  editorialSourcePackets,
  raceSessions,
  raceWeekends,
  sessionResults,
  drivers,
  teams,
  pitStops,
  tireStints,
  sessionWeather,
  raceControlMessages,
  galleryImages,
  mediaGalleries,
  newsArticles,
  pendingArticles,
} from "@/lib/db/schema"
import { SourcePacket, SourcePacketMediaItem, SourcePacketNewsItem } from "./types"

// Helpers
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function calculateHash(data: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex")
}

async function readNewsSyncSnapshot(): Promise<SourcePacketNewsItem[]> {
  try {
    const file = join(process.cwd(), "data", "news-sync", "latest.json")
    const raw = await readFile(file, "utf8")
    const parsed = JSON.parse(raw)
    const items = Array.isArray(parsed.items) ? parsed.items : []
    return items.map((item: any) => ({
      source: item.source ?? "unknown",
      title: item.title ?? "",
      date: item.date ?? "",
      url: item.url ?? "",
      excerpt: item.excerpt ?? "",
      author: item.author ?? "",
      readTime: item.readTime ?? "",
      body: Array.isArray(item.body) ? item.body : [],
    }))
  } catch {
    return []
  }
}

async function buildMediaContext(
  season: number | null,
  round: number | null,
  gpName: string | null,
  driverCodes: string[],
  teamNames: string[]
): Promise<SourcePacketMediaItem[]> {
  const db = getDb()
  if (!db) return []

  try {
    const rows = await db
      .select({
        imageUrl: galleryImages.imageUrl,
        fileName: sql<string | null>`split_part(${galleryImages.imageUrl}, '/', cardinality(string_to_array(${galleryImages.imageUrl}, '/')))`,
        galleryTitle: mediaGalleries.title,
        folderKey: mediaGalleries.folderKey,
        createdAt: mediaGalleries.createdAt,
      })
      .from(galleryImages)
      .innerJoin(mediaGalleries, eq(galleryImages.galleryId, mediaGalleries.id))
      .orderBy(desc(mediaGalleries.createdAt), asc(galleryImages.sortOrder))
      .limit(300)

    const gpSearch = gpName ? normalizeForSearch(gpName) : ""
    const driverSearches = driverCodes.map((c) => c.toLowerCase())
    const teamSearches = teamNames.map((t) => normalizeForSearch(t))

    const scored: SourcePacketMediaItem[] = rows.map((row) => {
      const matchSignals: string[] = []
      let score = 0

      const galleryTitleLower = normalizeForSearch(row.galleryTitle)
      const folderKeyLower = row.folderKey ? row.folderKey.toLowerCase() : ""
      const filenameLower = row.fileName ? row.fileName.toLowerCase() : ""

      // Match GP/Event
      if (gpSearch && (galleryTitleLower.includes(gpSearch) || folderKeyLower.includes(gpSearch))) {
        score += 50
        matchSignals.push("gp_match")
      }

      // Match season
      const seasonStr = season ? String(season) : ""
      if (seasonStr && (galleryTitleLower.includes(seasonStr) || folderKeyLower.includes(seasonStr))) {
        score += 20
        matchSignals.push("season_match")
      }

      // Match drivers
      for (const code of driverSearches) {
        if (galleryTitleLower.includes(code) || folderKeyLower.includes(code) || filenameLower.includes(code)) {
          score += 15
          matchSignals.push(`driver_${code}`)
        }
      }

      // Match teams
      for (const team of teamSearches) {
        if (galleryTitleLower.includes(team) || folderKeyLower.includes(team) || filenameLower.includes(team)) {
          score += 10
          matchSignals.push(`team_${team}`)
        }
      }

      return {
        imageUrl: row.imageUrl,
        fileName: row.fileName,
        galleryTitle: row.galleryTitle,
        folderKey: row.folderKey,
        relatedSeason: season,
        relatedRound: round,
        relatedSessionType: null,
        matchSignals,
        relevanceScore: score,
      }
    })

    // Filter out items with 0 score (completely unrelated) and sort by score desc
    return scored
      .filter((item) => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8)
  } catch (error) {
    console.error("[source-packet] Failed to build media context:", error)
    return []
  }
}

export async function buildSourcePacket(assignmentId: number): Promise<SourcePacket> {
  const db = getDb()
  if (!db) {
    throw new Error("DATABASE_URL nao definido ou falha na conexao.")
  }

  // 1. Fetch assignment
  const [assignmentRow] = await db
    .select()
    .from(editorialAssignments)
    .where(eq(editorialAssignments.id, assignmentId))
    .limit(1)

  if (!assignmentRow) {
    throw new Error(`Assignment ${assignmentId} nao encontrado.`)
  }

  const warnings: string[] = []

  // 2. Fetch Session and Event (RaceWeekend)
  let eventInfo: SourcePacket["event"] = null
  let sessionRow: any = null

  if (assignmentRow.sessionId) {
    const [sess] = await db
      .select({
        sessionId: raceSessions.id,
        sessionType: raceSessions.sessionType,
        startTimeUtc: raceSessions.startTimeUtc,
        endTimeUtc: raceSessions.endTimeUtc,
        season: raceWeekends.season,
        round: raceWeekends.round,
        grandPrixName: raceWeekends.grandPrixName,
        circuit: raceWeekends.circuit,
        country: raceWeekends.country,
        location: raceWeekends.location,
      })
      .from(raceSessions)
      .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
      .where(eq(raceSessions.id, assignmentRow.sessionId))
      .limit(1)

    if (sess) {
      sessionRow = sess
      eventInfo = {
        season: sess.season,
        round: sess.round,
        grandPrixName: sess.grandPrixName,
        circuit: sess.circuit,
        country: sess.country,
        location: sess.location,
      }
    } else {
      warnings.push(`Session ${assignmentRow.sessionId} referenciada no assignment mas nao encontrada no banco.`)
    }
  } else if (assignmentRow.season && assignmentRow.round) {
    // If no sessionId but we have weekend info
    const [wknd] = await db
      .select()
      .from(raceWeekends)
      .where(and(eq(raceWeekends.season, assignmentRow.season), eq(raceWeekends.round, assignmentRow.round)))
      .limit(1)

    if (wknd) {
      eventInfo = {
        season: wknd.season,
        round: wknd.round,
        grandPrixName: wknd.grandPrixName,
        circuit: wknd.circuit,
        country: wknd.country,
        location: wknd.location,
      }
    }
  }

  // 3. Official Results
  let officialResults: SourcePacket["officialResults"] = []
  if (assignmentRow.sessionId) {
    const resultsRows = await db
      .select({
        position: sessionResults.position,
        driverFullName: drivers.fullName,
        driverCode: drivers.code,
        driverNumber: drivers.driverNumber,
        teamName: teams.name,
        teamColor: teams.color,
        gridPosition: sessionResults.gridPosition,
        lapsCompleted: sessionResults.lapsCompleted,
        status: sessionResults.status,
        points: sessionResults.points,
        fastestLapRank: sessionResults.fastestLapRank,
        bestLapTime: sessionResults.bestLapTime,
      })
      .from(sessionResults)
      .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
      .innerJoin(teams, eq(drivers.teamId, teams.id))
      .where(eq(sessionResults.sessionId, assignmentRow.sessionId))
      .orderBy(asc(sessionResults.position))

    officialResults = resultsRows

    if (resultsRows.length === 0 && assignmentRow.assignmentType.endsWith("_result")) {
      warnings.push(`Dados oficiais de resultados vazios para a sessao ${assignmentRow.sessionId}.`)
    }
  }

  // 4. Sporting Context (Standings & Messages)
  const driverStandingsRows = await db
    .select({
      position: drivers.position,
      name: drivers.fullName,
      code: drivers.code,
      points: drivers.points,
      wins: drivers.wins,
    })
    .from(drivers)
    .orderBy(desc(drivers.points), asc(drivers.position))
    .limit(20)

  const constructorStandingsRows = await db
    .select({
      position: teams.position,
      name: teams.name,
      points: teams.points,
      wins: teams.wins,
    })
    .from(teams)
    .orderBy(desc(teams.points), asc(teams.position))
    .limit(10)

  let raceControlMessagesRows: SourcePacket["sportingContext"]["raceControlMessages"] = []
  if (assignmentRow.sessionId) {
    const msgs = await db
      .select({
        messageType: raceControlMessages.messageType,
        flag: raceControlMessages.flag,
        lap: raceControlMessages.lap,
        messageText: raceControlMessages.messageText,
        racingNumber: raceControlMessages.racingNumber,
        occurredAtUtc: raceControlMessages.occurredAtUtc,
      })
      .from(raceControlMessages)
      .where(eq(raceControlMessages.sessionId, assignmentRow.sessionId))
      .orderBy(asc(raceControlMessages.occurredAtUtc))
      .limit(30)

    raceControlMessagesRows = msgs.map((m) => ({
      ...m,
      occurredAtUtc: m.occurredAtUtc.toISOString(),
    }))
  }

  const sportingContext: SourcePacket["sportingContext"] = {
    driverStandings: driverStandingsRows,
    constructorStandings: constructorStandingsRows,
    raceControlMessages: raceControlMessagesRows,
  }

  // 5. Performance Context (Pit Stops, Stints, Weather)
  let pitStopsRows: SourcePacket["performanceContext"]["pitStops"] = []
  let tireStintsRows: SourcePacket["performanceContext"]["tireStints"] = []
  let weatherSamplesRows: SourcePacket["performanceContext"]["weatherSamples"] = []

  if (assignmentRow.sessionId) {
    // Pit stops
    const stops = await db
      .select({
        driverCode: drivers.code,
        lap: pitStops.lap,
        stopNumber: pitStops.stopNumber,
        duration: pitStops.duration,
      })
      .from(pitStops)
      .innerJoin(drivers, eq(pitStops.driverId, drivers.id))
      .where(eq(pitStops.sessionId, assignmentRow.sessionId))
      .orderBy(asc(pitStops.lap), asc(pitStops.stopNumber))

    pitStopsRows = stops

    // Tire stints
    const stints = await db
      .select({
        driverCode: drivers.code,
        stintNumber: tireStints.stintNumber,
        compound: tireStints.compound,
        lapStart: tireStints.lapStart,
        lapEnd: tireStints.lapEnd,
        tyreAgeAtStart: tireStints.tyreAgeAtStart,
      })
      .from(tireStints)
      .innerJoin(drivers, eq(tireStints.driverId, drivers.id))
      .where(eq(tireStints.sessionId, assignmentRow.sessionId))
      .orderBy(asc(drivers.code), asc(tireStints.stintNumber))

    tireStintsRows = stints

    // Weather samples
    const weather = await db
      .select({
        airTemperature: sessionWeather.airTemperature,
        trackTemperature: sessionWeather.trackTemperature,
        humidity: sessionWeather.humidity,
        rainfall: sessionWeather.rainfall,
        windSpeed: sessionWeather.windSpeed,
        recordedAtUtc: sessionWeather.recordedAtUtc,
      })
      .from(sessionWeather)
      .where(eq(sessionWeather.sessionId, assignmentRow.sessionId))
      .orderBy(asc(sessionWeather.recordedAtUtc))

    weatherSamplesRows = weather.map((w) => ({
      ...w,
      recordedAtUtc: w.recordedAtUtc.toISOString(),
    }))
  }

  const performanceContext: SourcePacket["performanceContext"] = {
    pitStops: pitStopsRows,
    tireStints: tireStintsRows,
    weatherSamples: weatherSamplesRows,
  }

  // 6. Recent News Sourced from latest.json
  const recentNews = await readNewsSyncSnapshot()

  // 7. Media Context (Photos matching GP/Drivers/Teams)
  const driverCodes = officialResults.map((r) => r.driverCode)
  const teamNames = Array.from(new Set(officialResults.map((r) => r.teamName)))
  const mediaContext = await buildMediaContext(
    eventInfo?.season ?? null,
    eventInfo?.round ?? null,
    eventInfo?.grandPrixName ?? null,
    driverCodes,
    teamNames
  )

  // 8. Coverage Context
  const publishedRows = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      excerpt: newsArticles.excerpt,
      category: newsArticles.category,
      date: newsArticles.publishedDate,
    })
    .from(newsArticles)
    .orderBy(desc(newsArticles.publishedDate))
    .limit(10)

  const pendingRows = await db
    .select({
      id: pendingArticles.id,
      title: pendingArticles.title,
      excerpt: pendingArticles.excerpt,
      category: pendingArticles.category,
      date: pendingArticles.createdAt,
    })
    .from(pendingArticles)
    .where(eq(pendingArticles.status, "pending"))
    .orderBy(desc(pendingArticles.createdAt))
    .limit(10)

  const coverageContext: SourcePacket["coverageContext"] = {
    publishedArticles: publishedRows.map((r) => ({ ...r, date: r.date.toISOString() })),
    pendingArticles: pendingRows.map((r) => ({ ...r, date: r.date.toISOString() })),
  }

  // Combine everything
  const packet: SourcePacket = {
    assignment: {
      id: assignmentRow.id,
      source: assignmentRow.source,
      rawInput: assignmentRow.rawInput,
      topicCanonical: assignmentRow.topicCanonical,
      assignmentType: assignmentRow.assignmentType as any,
      editorialDesk: assignmentRow.editorialDesk as any,
      season: assignmentRow.season,
      round: assignmentRow.round,
      sessionId: assignmentRow.sessionId,
      status: assignmentRow.status,
      locale: assignmentRow.locale,
    },
    event: eventInfo,
    officialResults,
    sportingContext,
    performanceContext,
    recentNews,
    mediaContext,
    coverageContext,
    sourceWarnings: warnings,
  }

  // Calculate hash and save to database
  const packetHash = calculateHash(packet)
  const sourceSummary = `${eventInfo ? `${eventInfo.grandPrixName} ` : ""}${assignmentRow.assignmentType} (results: ${officialResults.length}, news: ${recentNews.length}, photos: ${mediaContext.length})`

  await db.insert(editorialSourcePackets).values({
    assignmentId: assignmentRow.id,
    packetJson: packet as any,
    packetHash,
    sourceSummary,
  })

  return packet
}

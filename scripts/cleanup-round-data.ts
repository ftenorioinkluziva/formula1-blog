import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv()

import { and, count, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  carTelemetry,
  fantasyPredictions,
  fantasyRoundEntries,
  fantasyRoundScores,
  fantasyTransfers,
  f1tvSyncPoints,
  lapSummaries,
  pitStops,
  raceControlMessages,
  raceIntervals,
  raceSessions,
  raceWeekends,
  sessionResults,
  sessionStatusEvents,
  sessionWeather,
  teamRadio,
  tireStints,
} from "@/lib/db/schema"

const args = process.argv.slice(2)
const season = Number(args[0] ?? 2026)
const rounds = (args.slice(1).join(",") || "4,5")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0)

const execute = process.argv.includes("--execute")

function logJson(label: string, value: unknown) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`)
}

async function main() {
  const db = getDb()
  if (!db) {
    throw new Error("Database unavailable")
  }

  const weekends = await db
    .select({ id: raceWeekends.id, round: raceWeekends.round, grandPrixName: raceWeekends.grandPrixName })
    .from(raceWeekends)
    .where(and(eq(raceWeekends.season, season), inArray(raceWeekends.round, rounds)))

  if (weekends.length === 0) {
    throw new Error(`No weekends found for season ${season} and rounds ${rounds.join(",")}`)
  }

  const weekendIds = weekends.map((weekend) => weekend.id)
  const sessions = await db
    .select({ id: raceSessions.id, weekendId: raceSessions.weekendId, sessionType: raceSessions.sessionType, sessionCode: raceSessions.sessionCode })
    .from(raceSessions)
    .where(inArray(raceSessions.weekendId, weekendIds))

  const sessionIds = sessions.map((session) => session.id)

  const counters = {
    raceControlMessages: sessionIds.length
      ? (await db.select({ c: count() }).from(raceControlMessages).where(inArray(raceControlMessages.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    sessionStatusEvents: sessionIds.length
      ? (await db.select({ c: count() }).from(sessionStatusEvents).where(inArray(sessionStatusEvents.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    sessionResults: sessionIds.length
      ? (await db.select({ c: count() }).from(sessionResults).where(inArray(sessionResults.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    lapSummaries: sessionIds.length
      ? (await db.select({ c: count() }).from(lapSummaries).where(inArray(lapSummaries.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    pitStops: sessionIds.length
      ? (await db.select({ c: count() }).from(pitStops).where(inArray(pitStops.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    tireStints: sessionIds.length
      ? (await db.select({ c: count() }).from(tireStints).where(inArray(tireStints.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    sessionWeather: sessionIds.length
      ? (await db.select({ c: count() }).from(sessionWeather).where(inArray(sessionWeather.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
      raceIntervals: sessionIds.length
      ? (await db.select({ c: count() }).from(raceIntervals).where(inArray(raceIntervals.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    teamRadio: sessionIds.length
      ? (await db.select({ c: count() }).from(teamRadio).where(inArray(teamRadio.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    carTelemetry: sessionIds.length
      ? (await db.select({ c: count() }).from(carTelemetry).where(inArray(carTelemetry.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    f1tvSyncPoints: sessionIds.length
      ? (await db.select({ c: count() }).from(f1tvSyncPoints).where(inArray(f1tvSyncPoints.sessionId, sessionIds)))[0]?.c ?? 0
      : 0,
    fantasyRoundEntries: (await db.select({ c: count() }).from(fantasyRoundEntries).where(inArray(fantasyRoundEntries.weekendId, weekendIds)))[0]?.c ?? 0,
    fantasyPredictions: (await db.select({ c: count() }).from(fantasyPredictions).where(inArray(fantasyPredictions.weekendId, weekendIds)))[0]?.c ?? 0,
    fantasyRoundScores: (await db.select({ c: count() }).from(fantasyRoundScores).where(inArray(fantasyRoundScores.weekendId, weekendIds)))[0]?.c ?? 0,
    fantasyTransfers: (await db.select({ c: count() }).from(fantasyTransfers).where(inArray(fantasyTransfers.weekendId, weekendIds)))[0]?.c ?? 0,
  }

  logJson("weekends", weekends)
  logJson("sessions", sessions)
  logJson("counts", counters)

  if (!execute) {
    console.log("Dry run only. Re-run with --execute to delete data.")
    return
  }

  if (sessionIds.length > 0) {
    await db.delete(raceControlMessages).where(inArray(raceControlMessages.sessionId, sessionIds))
    await db.delete(sessionStatusEvents).where(inArray(sessionStatusEvents.sessionId, sessionIds))
    await db.delete(sessionResults).where(inArray(sessionResults.sessionId, sessionIds))
    await db.delete(lapSummaries).where(inArray(lapSummaries.sessionId, sessionIds))
    await db.delete(pitStops).where(inArray(pitStops.sessionId, sessionIds))
    await db.delete(tireStints).where(inArray(tireStints.sessionId, sessionIds))
    await db.delete(sessionWeather).where(inArray(sessionWeather.sessionId, sessionIds))
    await db.delete(raceIntervals).where(inArray(raceIntervals.sessionId, sessionIds))
    await db.delete(teamRadio).where(inArray(teamRadio.sessionId, sessionIds))
    await db.delete(carTelemetry).where(inArray(carTelemetry.sessionId, sessionIds))
    await db.delete(f1tvSyncPoints).where(inArray(f1tvSyncPoints.sessionId, sessionIds))
  }

  await db.delete(fantasyPredictions).where(inArray(fantasyPredictions.weekendId, weekendIds))
  await db.delete(fantasyRoundScores).where(inArray(fantasyRoundScores.weekendId, weekendIds))
  await db.delete(fantasyTransfers).where(inArray(fantasyTransfers.weekendId, weekendIds))
  await db.delete(fantasyRoundEntries).where(inArray(fantasyRoundEntries.weekendId, weekendIds))

  await db
    .update(raceSessions)
    .set({ status: "cancelled" })
    .where(inArray(raceSessions.weekendId, weekendIds))

  console.log("Cleanup executed successfully.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

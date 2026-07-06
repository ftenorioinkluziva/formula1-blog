const { getDb } = require("../lib/db/client")
const { raceSessions, raceWeekends } = require("../lib/db/schema")
const { and, lte, gte, ne, desc, eq } = require("drizzle-orm")

const db = getDb()
if (!db) {
  console.log("no db")
  process.exit(1)
}

const SESSION_TYPES = new Set(["Practice 1","Practice 2","Practice 3","Sprint","Sprint Qualifying","Sprint Shootout","Qualifying","Race"])
const now = new Date()
const windowStart = new Date(now.getTime() - 60 * 24 * 3600000)

db
  .select({
    sid: raceSessions.id,
    gp: raceWeekends.grandPrixName,
    st: raceSessions.sessionType,
    end: raceSessions.endTimeUtc,
    status: raceSessions.status,
  })
  .from(raceSessions)
  .innerJoin(raceWeekends, eq(raceSessions.weekendId, raceWeekends.id))
  .where(
    and(
      lte(raceSessions.endTimeUtc, now),
      gte(raceSessions.endTimeUtc, windowStart),
      ne(raceSessions.status, "cancelled"),
    ),
  )
  .orderBy(desc(raceSessions.endTimeUtc))
  .then((rows) => {
    const filtered = rows.filter((r) => SESSION_TYPES.has(r.st))
    console.log(filtered.length, "eligible sessions")
    for (const r of filtered.slice(0, 5)) {
      console.log(" ", r.sid, r.gp, r.st, r.end instanceof Date ? r.end.toISOString() : r.end, "status:", r.status)
    }
    if (filtered.length === 0) {
      console.log("all rows (unfiltered):", rows.length)
      for (const r of rows.slice(0, 5)) {
        console.log(" ", r.sid, r.gp, r.st, typeof r.end === "object" ? r.end.toISOString() : r.end)
      }
    }
  })
  .catch((e) => console.error(e))

import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { and, desc, eq, gte, lte, ne } from "drizzle-orm"
import { config as loadEnv } from "dotenv"

import { getDb } from "../lib/db/client"
import { raceSessions, raceWeekends } from "../lib/db/schema"
import { createTopicPendingArticle } from "./topic-article"

loadEnv({ path: ".env.local" })
loadEnv()

const execFileAsync = promisify(execFile)
const STATE_FILE = path.join(process.cwd(), ".cache", "f1blog-session-scheduler.json")
const SESSION_TYPES = new Set([
  "Practice 1",
  "Practice 2",
  "Practice 3",
  "Sprint",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Qualifying",
  "Race",
])

type JobStatus = "pending" | "retrying" | "done" | "expired" | "failed"
type JobType = "photos" | "topic"

type SchedulerJob = {
  sessionId: number
  jobType: JobType
  grandPrixName: string
  sessionType: string
  sessionStatus: string
  endTimeUtc: string
  status: JobStatus
  attemptCount: number
  firstAttemptAt: string | null
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  completedAt: string | null
  lastResult: string | null
}

type SchedulerState = {
  version: 1
  jobs: Record<string, SchedulerJob>
}

type SessionInfo = {
  sessionId: number
  grandPrixName: string
  sessionType: string
  status: string
  startTimeUtc: Date
  endTimeUtc: Date
}

type Args = {
  photos: boolean
  topics: boolean
  dryRun: boolean
  photosDelayMinutes: number
  photosRetryMinutes: number
  photosWindowHours: number
  topicDelayMinutes: number
  topicRetryMinutes: number
  topicWindowHours: number
  topicMaxAttempts: number
  photoMaxGalleries: number
  photoDays: number
  photoHistoryDays: number
}

function parseArgs(): Args {
  const raw = process.argv.slice(2)
  const has = (name: string) => raw.includes(name)
  const numberArg = (name: string, fallback: number): number => {
    const index = raw.indexOf(name)
    if (index === -1) return fallback
    const value = Number(raw[index + 1])
    return Number.isFinite(value) && value > 0 ? value : fallback
  }

  const photosOnly = has("--fotos") || has("--photos")
  const topicsOnly = has("--topicos") || has("--topics")

  return {
    photos: photosOnly || !topicsOnly,
    topics: topicsOnly || !photosOnly,
    dryRun: has("--dry-run"),
    photosDelayMinutes: numberArg("--photos-delay-minutes", 30),
    photosRetryMinutes: numberArg("--photos-retry-minutes", 30),
    photosWindowHours: numberArg("--photos-window-hours", 1440),
    topicDelayMinutes: numberArg("--topic-delay-minutes", 60),
    topicRetryMinutes: numberArg("--topic-retry-minutes", 30),
    topicWindowHours: numberArg("--topic-window-hours", 6),
    topicMaxAttempts: numberArg("--topic-max-attempts", 3),
    photoMaxGalleries: numberArg("--photo-max-galleries", 20),
    photoDays: numberArg("--photo-days", 60),
    photoHistoryDays: numberArg("--photo-history-days", 60),
  }
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

function jobKey(jobType: JobType, sessionId: number): string {
  return `${jobType}:${sessionId}`
}

function topicName(session: SessionInfo): string {
  return `${session.grandPrixName} - ${session.sessionType}`
}

async function loadState(): Promise<SchedulerState> {
  try {
    const text = await fs.readFile(STATE_FILE, "utf8")
    const parsed = JSON.parse(text) as SchedulerState
    return { version: 1, jobs: parsed.jobs ?? {} }
  } catch {
    return { version: 1, jobs: {} }
  }
}

async function saveState(state: SchedulerState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true })
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8")
}

function ensureJob(state: SchedulerState, jobType: JobType, session: SessionInfo, nextAttemptAt: Date): SchedulerJob {
  const key = jobKey(jobType, session.sessionId)
  const existing = state.jobs[key]
  if (existing) return existing

  const job: SchedulerJob = {
    sessionId: session.sessionId,
    jobType,
    grandPrixName: session.grandPrixName,
    sessionType: session.sessionType,
    sessionStatus: session.status,
    endTimeUtc: session.endTimeUtc.toISOString(),
    status: "pending",
    attemptCount: 0,
    firstAttemptAt: null,
    lastAttemptAt: null,
    nextAttemptAt: nextAttemptAt.toISOString(),
    completedAt: null,
    lastResult: null,
  }
  state.jobs[key] = job
  return job
}

async function listEndedSessions(historyDays: number): Promise<SessionInfo[]> {
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL nao definido.")

  const now = new Date()
  const windowStart = new Date(now.getTime() - historyDays * 24 * 3_600_000)
  const rows = await db
    .select({
      sessionId: raceSessions.id,
      grandPrixName: raceWeekends.grandPrixName,
      sessionType: raceSessions.sessionType,
      status: raceSessions.status,
      startTimeUtc: raceSessions.startTimeUtc,
      endTimeUtc: raceSessions.endTimeUtc,
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

  return rows.filter((row) => SESSION_TYPES.has(row.sessionType))
}

function dueJobs(
  state: SchedulerState,
  sessions: SessionInfo[],
  jobType: JobType,
  delayMinutes: number,
  windowHours: number,
  maxAttempts?: number,
): Array<{ session: SessionInfo; job: SchedulerJob }> {
  const now = new Date()
  const due: Array<{ session: SessionInfo; job: SchedulerJob }> = []

  for (const session of sessions) {
    const firstTryAt = addMinutes(session.endTimeUtc, delayMinutes)
    const expiresAt = addHours(session.endTimeUtc, windowHours)
    const job = ensureJob(state, jobType, session, firstTryAt)

    if (job.status === "done" || job.status === "expired" || job.status === "failed") continue
    if (now > expiresAt) {
      job.status = "expired"
      job.completedAt = now.toISOString()
      job.lastResult = `Janela de tentativa expirada para ${jobType}`
      continue
    }
    if (maxAttempts && job.attemptCount >= maxAttempts) {
      job.status = "failed"
      job.completedAt = now.toISOString()
      job.lastResult = `Numero maximo de tentativas atingido para ${jobType}`
      continue
    }

    const nextAttemptAt = job.nextAttemptAt ? new Date(job.nextAttemptAt) : firstTryAt
    if (nextAttemptAt <= now) due.push({ session, job })
  }

  return due.sort((a, b) => a.session.endTimeUtc.getTime() - b.session.endTimeUtc.getTime())
}

function parsePhotoOutput(output: string): { newImages: number; totalProcessed: number } {
  const newImages = Number(output.match(/Novas imagens baixadas:\s*(\d+)/)?.[1] ?? 0)
  const totalProcessed = Number(output.match(/Total processado:\s*(\d+)/)?.[1] ?? 0)
  return { newImages, totalProcessed }
}

function markAttempt(job: SchedulerJob, now: Date): void {
  job.attemptCount += 1
  job.firstAttemptAt ??= now.toISOString()
  job.lastAttemptAt = now.toISOString()
}

async function runPhotoJobs(state: SchedulerState, sessions: SessionInfo[], args: Args): Promise<void> {
  const due = dueJobs(state, sessions, "photos", args.photosDelayMinutes, args.photosWindowHours)
  if (due.length === 0) {
    console.log("[photos] Nenhuma sessao elegivel para scrape de fotos.")
    return
  }

  console.log(`[photos] Sessoes aguardando fotos: ${due.map((item) => topicName(item.session)).join(", ")}`)
  if (args.dryRun) return

  const now = new Date()
  const commandArgs = [
    "scripts/scrape-fotos.ts",
    "--cleanup",
    "--max-galleries",
    String(args.photoMaxGalleries),
    "--days",
    String(args.photoDays),
  ]
  const result = await execFileAsync("./node_modules/.bin/tsx", commandArgs, {
    cwd: process.cwd(),
    maxBuffer: 30 * 1024 * 1024,
  }).then(
    ({ stdout, stderr }) => ({ returnCode: 0, output: [stdout, stderr].filter(Boolean).join("\n") }),
    (error: Error & { stdout?: string; stderr?: string; code?: number }) => ({
      returnCode: typeof error.code === "number" ? error.code : 1,
      output: [error.stdout, error.stderr, error.message].filter(Boolean).join("\n"),
    }),
  )

  if (result.output.trim()) console.log(result.output.trim())
  const { newImages, totalProcessed } = parsePhotoOutput(result.output)
  const success = result.returnCode === 0 && totalProcessed > 0

  for (const { session, job } of due) {
    markAttempt(job, now)
    const summary = `rc=${result.returnCode}, novas=${newImages}, total=${totalProcessed}`

    if (success) {
      job.status = "done"
      job.completedAt = now.toISOString()
      job.lastResult = `Fotos processadas com sucesso (${summary})`
      console.log(`[photos] Concluido para ${topicName(session)}.`)
      continue
    }

    const nextAttemptAt = addMinutes(now, args.photosRetryMinutes)
    const expiresAt = addHours(session.endTimeUtc, args.photosWindowHours)
    if (nextAttemptAt > expiresAt) {
      job.status = "expired"
      job.completedAt = now.toISOString()
      job.lastResult = `Sem fotos ate o fim da janela (${summary})`
      console.log(`[photos] Expirado para ${topicName(session)}.`)
    } else {
      job.status = "retrying"
      job.nextAttemptAt = nextAttemptAt.toISOString()
      job.lastResult = `Sem fotos ainda (${summary})`
      console.log(`[photos] Retry agendado para ${topicName(session)} em ${nextAttemptAt.toISOString()}.`)
    }
  }
}

async function runTopicJobs(state: SchedulerState, sessions: SessionInfo[], args: Args): Promise<void> {
  const due = dueJobs(state, sessions, "topic", args.topicDelayMinutes, args.topicWindowHours, args.topicMaxAttempts)
  if (due.length === 0) {
    console.log("[topic] Nenhuma sessao elegivel para artigo por topico.")
    return
  }

  const now = new Date()
  for (const { session, job } of due) {
    const topic = topicName(session)
    console.log(`[topic] Gerando artigo para ${topic}...`)
    if (args.dryRun) continue

    markAttempt(job, now)
    try {
      const saved = await createTopicPendingArticle(topic)
      job.status = "done"
      job.completedAt = now.toISOString()
      job.lastResult = `Artigo salvo${saved.id ? ` [ID ${saved.id}]` : ""}: ${saved.title}`
      console.log(`[topic] Concluido para ${topic}: ${saved.title}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const nextAttemptAt = addMinutes(now, args.topicRetryMinutes)
      const expiresAt = addHours(session.endTimeUtc, args.topicWindowHours)

      if (job.attemptCount >= args.topicMaxAttempts) {
        job.status = "failed"
        job.completedAt = now.toISOString()
        job.lastResult = `Falhou apos ${job.attemptCount} tentativas: ${message}`
        console.log(`[topic] Falha definitiva para ${topic}: ${message}`)
      } else if (nextAttemptAt > expiresAt) {
        job.status = "expired"
        job.completedAt = now.toISOString()
        job.lastResult = `Janela de tentativa expirada para topico: ${message}`
        console.log(`[topic] Expirado para ${topic}: ${message}`)
      } else {
        job.status = "retrying"
        job.nextAttemptAt = nextAttemptAt.toISOString()
        job.lastResult = `Falha temporaria: ${message}`
        console.log(`[topic] Retry agendado para ${topic} em ${nextAttemptAt.toISOString()}.`)
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const state = await loadState()
  const sessions = await listEndedSessions(args.photoHistoryDays)

  if (args.photos) await runPhotoJobs(state, sessions, args)
  if (args.topics) await runTopicJobs(state, sessions, args)

  if (!args.dryRun) await saveState(state)
}

main().catch((error) => {
  console.error("[session-scheduler]", error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

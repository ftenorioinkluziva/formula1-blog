import "server-only"

import { existsSync } from "node:fs"
import { mkdir, rename, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

type LiveTimingLogEvent =
  | "snapshot_fetched"
  | "snapshot_fetch_failed"
  | "cache_hit"
  | "inflight_join"
  | "db_persist_failed"

interface LiveTimingLogEntry {
  ts: string
  event: LiveTimingLogEvent
  data: Record<string, unknown>
}

const ENABLE_FILE_LOG = process.env.LIVE_TIMING_FILE_LOG !== "0"
const LOG_DIR = join(process.cwd(), "logs")
const LOG_FILE = join(LOG_DIR, "live-timing.ndjson")
const LOG_FILE_ROTATED = join(LOG_DIR, "live-timing.1.ndjson")
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024

let queue: Promise<void> = Promise.resolve()

async function rotateIfNeeded(): Promise<void> {
  if (!existsSync(LOG_FILE)) return

  const current = await stat(LOG_FILE)
  if (current.size < MAX_LOG_SIZE_BYTES) return

  if (existsSync(LOG_FILE_ROTATED)) {
    await writeFile(LOG_FILE_ROTATED, "", "utf8")
  }

  await rename(LOG_FILE, LOG_FILE_ROTATED)
}

export function appendLiveTimingLog(event: LiveTimingLogEvent, data: Record<string, unknown>): void {
  if (!ENABLE_FILE_LOG) return

  const entry: LiveTimingLogEntry = {
    ts: new Date().toISOString(),
    event,
    data,
  }

  queue = queue
    .then(async () => {
      await mkdir(LOG_DIR, { recursive: true })
      await rotateIfNeeded()
      await writeFile(LOG_FILE, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "a" })
    })
    .catch(() => undefined)
}

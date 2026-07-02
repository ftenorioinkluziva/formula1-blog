import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1))
  return sortedValues[index]
}

function average(values) {
  if (!values.length) return null
  const total = values.reduce((acc, curr) => acc + curr, 0)
  return total / values.length
}

function round(value, digits = 2) {
  if (value === null || value === undefined) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatMs(value) {
  if (value === null || value === undefined) return "—"
  return `${round(value, 2)} ms`
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—"
  return `${round(value, 2)}%`
}

async function main() {
  const targetPath = resolve(process.argv[2] || join(process.cwd(), "logs", "live-timing.ndjson"))
  const outputDir = resolve(process.argv[3] || join(process.cwd(), "logs"))

  const raw = await readFile(targetPath, "utf8")
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)

  const records = []
  for (const line of lines) {
    try {
      records.push(JSON.parse(line))
    } catch {
      continue
    }
  }

  const snapshots = records.filter((record) => record?.event === "snapshot_fetched")
  const failures = records.filter((record) => record?.event === "snapshot_fetch_failed")

  if (!snapshots.length) {
    throw new Error(`Nenhum evento snapshot_fetched encontrado em ${targetPath}`)
  }

  const withIntervals = []
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = new Date(snapshots[index - 1].ts)
    const current = new Date(snapshots[index].ts)
    const delta = current.getTime() - previous.getTime()
    const durationMs = toNumber(snapshots[index]?.data?.durationMs)
    withIntervals.push({
      ts: snapshots[index].ts,
      status: snapshots[index]?.data?.summary?.sessionStatus || "Unknown",
      lap: toNumber(snapshots[index]?.data?.summary?.currentLap),
      dtMs: delta,
      durationMs,
    })
  }

  const durations = withIntervals.map((item) => item.durationMs).filter((value) => value !== null)
  const intervals = withIntervals.map((item) => item.dtMs).filter((value) => value !== null)
  const sortedDurations = [...durations].sort((a, b) => a - b)
  const sortedIntervals = [...intervals].sort((a, b) => a - b)

  const firstTs = snapshots[0].ts
  const lastTs = snapshots[snapshots.length - 1].ts
  const elapsedMs = new Date(lastTs).getTime() - new Date(firstTs).getTime()

  const lastSnapshot = snapshots[snapshots.length - 1]
  const finalUpstreamFetches = toNumber(lastSnapshot?.data?.upstreamFetches)
  const finalCacheHits = toNumber(lastSnapshot?.data?.cacheHits)
  const finalInFlightJoins = toNumber(lastSnapshot?.data?.inFlightJoins)
  const finalErrors = toNumber(lastSnapshot?.data?.errors)

  const summary = {
    sourceFile: basename(targetPath),
    generatedAt: new Date().toISOString(),
    session: {
      firstTs,
      lastTs,
      elapsedMinutes: round(elapsedMs / 60000, 2),
    },
    totals: {
      snapshots: snapshots.length,
      failures: failures.length,
      finalUpstreamFetches,
      finalCacheHits,
      finalInFlightJoins,
      finalErrors,
      cacheHitRatioPercent:
        finalUpstreamFetches && finalUpstreamFetches > 0 && finalCacheHits !== null
          ? round((100 * finalCacheHits) / finalUpstreamFetches, 2)
          : null,
    },
    latency: {
      durationMs: {
        min: sortedDurations.length ? sortedDurations[0] : null,
        avg: round(average(durations), 2),
        p95: percentile(sortedDurations, 95),
        max: sortedDurations.length ? sortedDurations[sortedDurations.length - 1] : null,
      },
      intervalMs: {
        min: sortedIntervals.length ? sortedIntervals[0] : null,
        avg: round(average(intervals), 2),
        p95: percentile(sortedIntervals, 95),
        max: sortedIntervals.length ? sortedIntervals[sortedIntervals.length - 1] : null,
      },
    },
  }

  const byStatusMap = new Map()
  for (const row of withIntervals) {
    if (!byStatusMap.has(row.status)) {
      byStatusMap.set(row.status, [])
    }
    byStatusMap.get(row.status).push(row)
  }

  const byStatus = Array.from(byStatusMap.entries())
    .map(([status, rows]) => {
      const statusDurations = rows.map((row) => row.durationMs).filter((value) => value !== null)
      const statusIntervals = rows.map((row) => row.dtMs).filter((value) => value !== null)
      const sortedStatusDurations = [...statusDurations].sort((a, b) => a - b)
      const sortedStatusIntervals = [...statusIntervals].sort((a, b) => a - b)
      return {
        status,
        count: rows.length,
        avgDurationMs: round(average(statusDurations), 2),
        p95DurationMs: percentile(sortedStatusDurations, 95),
        avgIntervalMs: round(average(statusIntervals), 2),
        p95IntervalMs: percentile(sortedStatusIntervals, 95),
      }
    })
    .sort((a, b) => b.count - a.count)

  const spikes = withIntervals
    .filter((row) => row.durationMs !== null)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((row) => ({
      ts: row.ts,
      status: row.status,
      lap: row.lap,
      durationMs: row.durationMs,
      dtMs: row.dtMs,
    }))

  const outliers = {
    durationGe100Ms: withIntervals.filter((row) => row.durationMs !== null && row.durationMs >= 100).map((row) => ({
      ts: row.ts,
      status: row.status,
      lap: row.lap,
      durationMs: row.durationMs,
      dtMs: row.dtMs,
    })),
    intervalGe1500Ms: withIntervals.filter((row) => row.dtMs >= 1500).map((row) => ({
      ts: row.ts,
      status: row.status,
      lap: row.lap,
      durationMs: row.durationMs,
      dtMs: row.dtMs,
    })),
  }

  const report = {
    summary,
    byStatus,
    spikes,
    outliers,
  }

  await mkdir(outputDir, { recursive: true })

  const jsonPath = join(outputDir, "live-timing-report.latest.json")
  const mdPath = join(outputDir, "live-timing-report.latest.md")

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  const statusRows = byStatus
    .map(
      (row) =>
        `| ${row.status} | ${row.count} | ${formatMs(row.avgDurationMs)} | ${formatMs(
          row.p95DurationMs,
        )} | ${formatMs(row.avgIntervalMs)} | ${formatMs(row.p95IntervalMs)} |`,
    )
    .join("\n")

  const spikeRows = spikes
    .map(
      (row) =>
        `| ${row.ts} | ${row.status} | ${row.lap ?? "—"} | ${formatMs(row.durationMs)} | ${formatMs(row.dtMs)} |`,
    )
    .join("\n")

  const markdown = [
    "# Live Timing — Relatório Pós-Sessão",
    "",
    `- Fonte: ${basename(targetPath)}`,
    `- Gerado em: ${summary.generatedAt}`,
    `- Janela da sessão: ${summary.session.firstTs} → ${summary.session.lastTs} (${summary.session.elapsedMinutes} min)`,
    "",
    "## Resumo",
    "",
    `- Snapshots: ${summary.totals.snapshots}`,
    `- Falhas: ${summary.totals.failures}`,
    `- Cache hit ratio: ${formatPercent(summary.totals.cacheHitRatioPercent)}`,
    `- Latência fetch (média/p95): ${formatMs(summary.latency.durationMs.avg)} / ${formatMs(
      summary.latency.durationMs.p95,
    )}`,
    `- Intervalo entre snapshots (média/p95): ${formatMs(summary.latency.intervalMs.avg)} / ${formatMs(
      summary.latency.intervalMs.p95,
    )}`,
    "",
    "## Métricas por status",
    "",
    "| Status | Eventos | Avg duration | P95 duration | Avg interval | P95 interval |",
    "|---|---:|---:|---:|---:|---:|",
    statusRows || "| — | 0 | — | — | — | — |",
    "",
    "## Top 10 picos de duration",
    "",
    "| Timestamp | Status | Lap | Duration | Intervalo anterior |",
    "|---|---|---:|---:|---:|",
    spikeRows || "| — | — | — | — | — |",
    "",
    "## Outliers",
    "",
    `- duration >= 100ms: ${outliers.durationGe100Ms.length}`,
    `- interval >= 1500ms: ${outliers.intervalGe1500Ms.length}`,
    "",
  ].join("\n")

  await writeFile(mdPath, `${markdown}\n`, "utf8")

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: targetPath,
        outputs: {
          json: jsonPath,
          markdown: mdPath,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exit(1)
})

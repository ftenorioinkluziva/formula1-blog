import { NextRequest, NextResponse } from "next/server"
import {
  getLiveTimingSnapshotHistory,
  getLatestLiveTimingSnapshot,
  getLiveTimingSnapshotStoreStats,
  getSharedLiveTimingSnapshot,
} from "@/lib/live-timing/persistence/live-timing-snapshot-store"
import { getQualifyingBestLapState } from "@/lib/live-timing/persistence/qualifying-best-lap-store"
import { getQualifyingMiniSectorBestState } from "@/lib/live-timing/persistence/qualifying-mini-sector-best-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parsePositiveInt(value: string | null, fallback: number, max = 200): number {
  if (!value) return fallback
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.min(Math.floor(numeric), max)
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode") || "latest"

    if (mode === "history") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 30)
      const history = getLiveTimingSnapshotHistory(limit).map((snapshot) => ({
        id: snapshot.id,
        capturedAtIso: snapshot.capturedAtIso,
        summary: snapshot.summary,
      }))

      return NextResponse.json(
        {
          mode: "history",
          history,
          stats: getLiveTimingSnapshotStoreStats(),
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    if (mode === "stats") {
      return NextResponse.json(
        {
          mode: "stats",
          stats: getLiveTimingSnapshotStoreStats(),
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    if (mode === "qualifying-best-laps") {
      return NextResponse.json(
        {
          mode: "qualifying-best-laps",
          qualifyingBestLaps: getQualifyingBestLapState(),
          stats: getLiveTimingSnapshotStoreStats(),
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    const forceRefresh = url.searchParams.get("refresh") === "1"
    const freshSnapshot = await getSharedLiveTimingSnapshot(forceRefresh)
    const snapshot = freshSnapshot ?? getLatestLiveTimingSnapshot()

    if (!snapshot) {
      return NextResponse.json(
        {
          mode: "latest",
          data: null,
          meta: { noSession: true },
          stats: getLiveTimingSnapshotStoreStats(),
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    return NextResponse.json(
      {
        mode: "latest",
        data: {
          ...snapshot.rawState,
          PersistedMiniSectorBest: getQualifyingMiniSectorBestState(),
        },
        meta: {
          id: snapshot.id,
          capturedAtIso: snapshot.capturedAtIso,
          summary: snapshot.summary,
          stale: freshSnapshot == null,
        },
        stats: getLiveTimingSnapshotStoreStats(),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal error while reading live timing snapshot" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

"use client"

import { useEffect, useState } from "react"
import { subscribeLiveTiming } from "@/lib/live-timing/api"
import { parseDriverMiniSectors } from "@/lib/live-timing/parsers"
import type { DriverMiniSectors } from "@/lib/live-timing/types"

export function useMiniSectors(intervalMs = 2000): Map<string, DriverMiniSectors> {
  const [map, setMap] = useState<Map<string, DriverMiniSectors>>(new Map())

  useEffect(() => {
    function load(raw: Parameters<typeof parseDriverMiniSectors>[0]) {
      const parsed = parseDriverMiniSectors(raw)
      const next = new Map<string, DriverMiniSectors>()
      for (const d of parsed) {
        next.set(d.racingNumber, d)
      }
      setMap(next)
    }
    return subscribeLiveTiming(load, intervalMs)
  }, [intervalMs])

  return map
}

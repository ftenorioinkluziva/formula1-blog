/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Driver,
  RaceMessage,
  RadioCapture,
  WeatherData,
  SessionInfo,
  SessionState,
  TrackState,
  F1LiveTimingRawState,
  LapCountData,
  PositionData,
  TimingStatsData,
  DriverStints,
  DriverSectors,
  DriverSpeed,
  TopThreeData,
  DriverTimingStats,
  DriverLapSeries,
  DriverRaceTrace,
  DriverLapHistory,
  WeatherSeriesPoint,
  PitStopTime,
  DriverMiniSectors,
  DriverSpeedTraps,
  ChampionshipPredictionEntry,
  ContentStream,
  SessionDataParsed,
  SessionTimelineEvent,
  LiveTimingClock,
} from "./types"
import { parseLapTimeToMs, toNumber, normalizeEntries } from "./formatters"

type TimingLine = {
  Line?: string
  Position?: string
  BestLapTime?: { Value?: string }
  LastLapTime?: { Value?: string }
  IntervalToPositionAhead?: { Value?: string }
  GapToLeader?: { Value?: string }
  Gap?: { Value?: string }
  InPit?: boolean
  PitOut?: boolean
  KnockedOut?: boolean
}

type TimingAppStint = {
  Compound?: string
  New?: string
  TotalLaps?: string | number
}

type TimingAppLine = {
  Stints?: Record<string, TimingAppStint>
}

type TimingStatsLine = {
  BestLapTime?: { Value?: string }
}

export function parseDriverData(rawState: F1LiveTimingRawState): Driver[] {
  const driverList = (rawState.DriverList || {}) as Record<string, { Tla?: string; FullName?: string; TeamName?: string; TeamColour?: string }>
  const timingData = (rawState.TimingData?.Lines || {}) as Record<string, TimingLine>
  const timingAppData = (rawState.TimingAppData?.Lines || {}) as Record<string, TimingAppLine>
  const timingStats = (rawState.TimingStats?.Lines || {}) as Record<string, TimingStatsLine>

  const drivers: Driver[] = []

  for (const [racingNumber, timingLine] of Object.entries(timingData)) {
    const driver = driverList[racingNumber]
    const appData = timingAppData[racingNumber]
    const stats = timingStats[racingNumber]

    if (!driver || !timingLine) continue

    const position = toNumber(timingLine.Line) || toNumber(timingLine.Position) || 0
    const bestLapValue = stats?.BestLapTime?.Value || timingLine.BestLapTime?.Value || "—"
    const lastLapValue = timingLine.LastLapTime?.Value || "—"
    
    // Gap real entre carros (IntervalToPositionAhead) ou gap para líder (GapToLeader)
    const intervalToAhead = timingLine.IntervalToPositionAhead?.Value || ""
    const gapToLeader = timingLine.GapToLeader?.Value || timingLine.Gap?.Value || ""
    
    // Prioriza intervalo entre carros para race, fallback para gap ao líder
    let gapValue = intervalToAhead || gapToLeader || "0.000"
    
    // Líder sempre tem gap "—"
    if (position === 1) {
      gapValue = "—"
    }
    
    const stints = appData?.Stints || {}
    const lastStintKey = Math.max(0, ...Object.keys(stints).map(Number))
    const lastStint = stints[lastStintKey] || {}

    drivers.push({
      pos: position,
      racingNumber,
      tla: driver.Tla || "???",
      fullName: driver.FullName || "Unknown",
      teamName: driver.TeamName || "",
      teamColour: driver.TeamColour || "808080",
      bestLap: bestLapValue,
      lastLap: lastLapValue,
      gap: gapValue,
      compound: lastStint.Compound || "UNKNOWN",
      isNew: lastStint.New === "true",
      tyreLaps: toNumber(lastStint.TotalLaps) || 0,
      inPit: timingLine.InPit === true,
      pitOut: timingLine.PitOut === true,
      knockedOut: timingLine.KnockedOut === true,
    })
  }

  drivers.sort((a, b) => a.pos - b.pos)

  return drivers
}

export function parseWeatherData(rawState: F1LiveTimingRawState): WeatherData | null {
  const weather = rawState.WeatherData
  if (!weather) return null

  return {
    airTemp: String(weather.AirTemp || "—"),
    trackTemp: String(weather.TrackTemp || "—"),
    humidity: String(weather.Humidity || "—"),
    pressure: String(weather.Pressure || "—"),
    rainfall: String(weather.Rainfall || "0"),
    windDirection: String(weather.WindDirection || "0"),
    windSpeed: String(weather.WindSpeed || "—"),
  }
}

export function parseSessionInfo(rawState: F1LiveTimingRawState): SessionInfo | null {
  const info = rawState.SessionInfo
  if (!info) return null

  return {
    name: info.Meeting?.Name || "Unknown Session",
    circuit: info.Meeting?.Circuit?.ShortName || info.Meeting?.Location || "Unknown",
    country: info.Meeting?.Country?.Name || info.Meeting?.Country?.Code || "Unknown",
    type: info.Type || info.Name || "Unknown",
    part: info.Part ? toNumber(info.Part) : null,
    path: info.Path || "",
  }
}

export function parseSessionState(rawState: F1LiveTimingRawState): SessionState | null {
  const status = rawState.SessionStatus?.Status
  const clock = rawState.ExtrapolatedClock
  
  if (!status && !clock) return null

  return {
    status: status || "Unknown",
    extrapolating: clock?.Extrapolating === true,
    remaining: clock?.Remaining || "—",
    utc: typeof clock?.Utc === "string" ? clock.Utc : undefined,
  }
}

export function parseLiveTimingClock(rawState: F1LiveTimingRawState): LiveTimingClock | null {
  const clock = rawState.LiveTimingClock as Record<string, any>
  if (!clock) return null

  const paused = clock.paused === true
  const systemTime = Number(clock.systemTime)
  const trackTime = Number(clock.trackTime)
  const liveTimingStartTime = Number(clock.liveTimingStartTime)

  if (![systemTime, trackTime, liveTimingStartTime].every((value) => Number.isFinite(value) && value > 0)) {
    return null
  }

  return {
    paused,
    systemTime,
    trackTime,
    liveTimingStartTime,
  }
}

export function parseTrackStatus(rawState: F1LiveTimingRawState): TrackState | null {
  const track = rawState.TrackStatus
  if (!track) return null

  return {
    status: String(track.Status || "1"),
    message: track.Message || "AllClear",
  }
}

export function parseRaceMessages(rawState: F1LiveTimingRawState): RaceMessage[] {
  const messages = rawState.RaceControlMessages?.Messages || {}
  const parsed: RaceMessage[] = normalizeEntries<Record<string, any>>(messages).map((msg) => ({
    utc: msg.Utc || new Date().toISOString(),
    lap: msg.Lap ? (toNumber(msg.Lap) ?? undefined) : undefined,
    category: msg.Category || "Other",
    message: msg.Message || "",
    status: msg.Status,
    flag: msg.Flag,
    scope: msg.Scope,
    sector: msg.Sector ? (toNumber(msg.Sector) ?? undefined) : undefined,
    racingNumber: msg.RacingNumber,
  }))

  return parsed.sort((a, b) => new Date(b.utc).getTime() - new Date(a.utc).getTime())
}

export function parseRadioCaptures(rawState: F1LiveTimingRawState): RadioCapture[] {
  const captures = rawState.TeamRadio?.Captures || {}
  const parsed: RadioCapture[] = normalizeEntries<Record<string, any>>(captures).map((cap) => ({
    utc: cap.Utc || new Date().toISOString(),
    racingNumber: cap.RacingNumber || "0",
    path: cap.Path || "",
  }))

  return parsed.sort((a, b) => new Date(b.utc).getTime() - new Date(a.utc).getTime())
}

export function buildDriverInfoMap(rawState: F1LiveTimingRawState): Record<string, { fullName: string; teamName: string; teamColour: string }> {
  const driverList = rawState.DriverList || {}
  const map: Record<string, { fullName: string; teamName: string; teamColour: string }> = {}

  for (const [racingNumber, driver] of Object.entries(driverList)) {
    map[racingNumber] = {
      fullName: driver.FullName || "Unknown",
      teamName: driver.TeamName || "",
      teamColour: driver.TeamColour || "808080",
    }
  }

  return map
}

export function parseLapCount(rawState: F1LiveTimingRawState): LapCountData | null {
  const lapCount = rawState.LapCount
  if (!lapCount) return null

  return {
    currentLap: toNumber(lapCount.CurrentLap) || 0,
    totalLaps: toNumber(lapCount.TotalLaps) || 0,
  }
}

export function parsePositionData(rawState: F1LiveTimingRawState): PositionData | null {
  // Position vem como um objeto contendo um array: {Position: [...]}
  const positionWrapper = rawState.Position as Record<string, any>
  const positionArray = Array.isArray(positionWrapper?.Position) 
    ? positionWrapper.Position 
    : null
  const positionEntry = positionArray?.[0]
  // Entries é um dict keyed pelo número do carro: { "44": { Status, X, Y, Z }, ... }
  const entriesDict = positionEntry?.Entries
  if (entriesDict && typeof entriesDict === "object" && !Array.isArray(entriesDict)) {
    const entries = Object.entries(entriesDict as Record<string, any>)
      .filter(([, v]) => v && typeof v === "object")
      .map(([racingNumber, entry]) => ({
        racingNumber,
        x: toNumber(entry.X) || 0,
        y: toNumber(entry.Y) || 0,
        z: toNumber(entry.Z) || 0,
        status: (entry.Status as string) || "OnTrack",
      }))
    if (entries.length > 0) return { entries }
  }

  // Fallback: Gera posições simuladas baseado na DriverList (para demo)
  const driverList = rawState.DriverList || {}
  const drivers = Object.entries(driverList)
  
  if (drivers.length === 0) return null

  // Simula posições em um circuito oval/retangular
  return {
    entries: drivers.map(([racingNumber], idx) => {
      const totalDrivers = drivers.length
      const angle = (idx / totalDrivers) * Math.PI * 2
      const radius = 400
      const x = 500 + radius * Math.cos(angle)
      const y = 500 + radius * Math.sin(angle)
      
      return {
        racingNumber,
        x,
        y,
        z: 0,
        status: "OnTrack",
      }
    }),
  }
}

export function parseTimingStats(rawState: F1LiveTimingRawState): TimingStatsData | null {
  const stats = rawState.TimingStats
  const lines = stats?.Lines || {}
  let bestLapTime = "—"
  let bestLapDriver = "—"
  let topSpeed = 0
  let topSpeedDriver = "—"
  
  const bestSectors = {
    sector1: "—",
    sector2: "—",
    sector3: "—",
  }

  const parseSectorMs = (value?: string) => {
    if (!value || value === "—") return null
    if (value.includes(":")) return parseLapTimeToMs(value)
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.round(numeric * 1000) : null
  }

  for (const [racingNumber, line] of Object.entries(lines)) {
    const lapTime = line.BestLapTime?.Value
    if (lapTime && lapTime !== "—") {
      const lapMs = parseLapTimeToMs(lapTime)
      const currentBestMs = parseLapTimeToMs(bestLapTime)
      if (lapMs && (!currentBestMs || lapMs < currentBestMs)) {
        bestLapTime = lapTime
        bestLapDriver = racingNumber
      }
    }

    const speeds: Record<string, any> = line.BestSpeeds || {}
    for (const speed of Object.values(speeds)) {
      const speedValue = toNumber(speed.Value)
      if (speedValue && speedValue > topSpeed) {
        topSpeed = speedValue
        topSpeedDriver = racingNumber
      }
    }

    const sectors = line.BestSectors || {}
    if (sectors[0]?.Value && sectors[0].Value !== "—") {
      const s1Ms = parseSectorMs(sectors[0].Value)
      const currentS1Ms = parseSectorMs(bestSectors.sector1)
      if (s1Ms && (!currentS1Ms || s1Ms < currentS1Ms)) {
        bestSectors.sector1 = sectors[0].Value
      }
    }
    if (sectors[1]?.Value && sectors[1].Value !== "—") {
      const s2Ms = parseSectorMs(sectors[1].Value)
      const currentS2Ms = parseSectorMs(bestSectors.sector2)
      if (s2Ms && (!currentS2Ms || s2Ms < currentS2Ms)) {
        bestSectors.sector2 = sectors[1].Value
      }
    }
    if (sectors[2]?.Value && sectors[2].Value !== "—") {
      const s3Ms = parseSectorMs(sectors[2].Value)
      const currentS3Ms = parseSectorMs(bestSectors.sector3)
      if (s3Ms && (!currentS3Ms || s3Ms < currentS3Ms)) {
        bestSectors.sector3 = sectors[2].Value
      }
    }
  }

  const hasTimingStats = Object.keys(lines).length > 0
  if (!hasTimingStats) {
    const timingLines = rawState.TimingData?.Lines || {}
    for (const [racingNumber, line] of Object.entries(timingLines)) {
      const lapTime = line.BestLapTime?.Value
      if (lapTime && lapTime !== "—") {
        const lapMs = parseLapTimeToMs(lapTime)
        const currentBestMs = parseLapTimeToMs(bestLapTime)
        if (lapMs && (!currentBestMs || lapMs < currentBestMs)) {
          bestLapTime = lapTime
          bestLapDriver = racingNumber
        }
      }

      const sectors = line.Sectors || []
      if (sectors[0]?.Value && sectors[0].Value !== "—") {
        const s1Ms = parseSectorMs(sectors[0].Value)
        const currentS1Ms = parseSectorMs(bestSectors.sector1)
        if (s1Ms && (!currentS1Ms || s1Ms < currentS1Ms)) {
          bestSectors.sector1 = sectors[0].Value
        }
      }
      if (sectors[1]?.Value && sectors[1].Value !== "—") {
        const s2Ms = parseSectorMs(sectors[1].Value)
        const currentS2Ms = parseSectorMs(bestSectors.sector2)
        if (s2Ms && (!currentS2Ms || s2Ms < currentS2Ms)) {
          bestSectors.sector2 = sectors[1].Value
        }
      }
      if (sectors[2]?.Value && sectors[2].Value !== "—") {
        const s3Ms = parseSectorMs(sectors[2].Value)
        const currentS3Ms = parseSectorMs(bestSectors.sector3)
        if (s3Ms && (!currentS3Ms || s3Ms < currentS3Ms)) {
          bestSectors.sector3 = sectors[2].Value
        }
      }
    }
  }

  if (bestLapTime === "—" && bestSectors.sector1 === "—" && bestSectors.sector2 === "—" && bestSectors.sector3 === "—") {
    return null
  }

  return {
    bestLapTime,
    bestLapDriver,
    bestSectors,
    topSpeed,
    topSpeedDriver,
  }
}

export function parseDriverTimingStats(rawState: F1LiveTimingRawState): DriverTimingStats[] {
  const stats = rawState.TimingStats
  if (!stats) return []

  const lines = stats.Lines || {}
  const result: DriverTimingStats[] = []

  for (const [racingNumber, line] of Object.entries(lines)) {
    const sectors = line.BestSectors || {}
    const speeds: Record<string, any> = line.BestSpeeds || {}

    const sector1 = sectors[0]?.Value || "—"
    const sector2 = sectors[1]?.Value || "—"
    const sector3 = sectors[2]?.Value || "—"

    let topSpeed = "—"
    for (const speed of Object.values(speeds)) {
      const speedValue = speed.Value
      if (speedValue && speedValue !== "—") {
        topSpeed = speedValue
        break
      }
    }

    result.push({
      racingNumber,
      sector1,
      sector2,
      sector3,
      topSpeed,
    })
  }

  return result
}

export function parseDriverStints(rawState: F1LiveTimingRawState): DriverStints[] {
  const timingAppData = rawState.TimingAppData?.Lines || {}
  const lapCount = rawState.LapCount
  const currentLap = toNumber(lapCount?.CurrentLap) || 0

  const allStints: DriverStints[] = []

  for (const [racingNumber, appData] of Object.entries(timingAppData)) {
    const stintsData: Record<string, any> = appData.Stints || {}
    const stints = []

    for (const [stintKey, stint] of Object.entries(stintsData)) {
      const stintNumber = toNumber(stintKey) || 0
      const totalLaps = toNumber(stint.TotalLaps) || 0

      const startLap = currentLap - totalLaps + 1

      stints.push({
        compound: stint.Compound || "UNKNOWN",
        isNew: stint.New === "true",
        totalLaps,
        startLap: Math.max(1, startLap),
        stintNumber,
      })
    }

    if (stints.length > 0) {
      allStints.push({
        racingNumber,
        stints: stints.sort((a, b) => a.stintNumber - b.stintNumber),
      })
    }
  }

  return allStints
}

export function parseAllDriverSectors(rawState: F1LiveTimingRawState): DriverSectors[] {
  const driverList = rawState.DriverList || {}
  const timingStats = rawState.TimingStats?.Lines || {}
  const timingData = rawState.TimingData?.Lines || {}

  const allSectors: DriverSectors[] = []

  const parseSectorValue = (value?: string) => {
    if (!value || value === "—") return "—"
    return value
  }

  const entries = Object.keys(timingStats).length > 0 ? timingStats : timingData

  for (const [racingNumber, line] of Object.entries(entries)) {
    const driver = driverList[racingNumber]
    const sectors = (line.BestSectors || line.Sectors || {}) as Record<string, any>
    
    allSectors.push({
      racingNumber,
      tla: driver?.Tla || "???",
      teamColour: driver?.TeamColour || "808080",
      sectors: {
        sector1: parseSectorValue(sectors[0]?.Value),
        sector2: parseSectorValue(sectors[1]?.Value),
        sector3: parseSectorValue(sectors[2]?.Value),
      },
      bestLapTime: line.BestLapTime?.Value || "—",
    })
  }

  return allSectors.filter((s) => s.sectors.sector1 !== "—" || s.sectors.sector2 !== "—" || s.sectors.sector3 !== "—")
}

export function parseAllDriverSpeeds(rawState: F1LiveTimingRawState): DriverSpeed[] {
  const driverList = rawState.DriverList || {}
  const timingStats = rawState.TimingStats?.Lines || {}

  const allSpeeds: DriverSpeed[] = []

  for (const [racingNumber, line] of Object.entries(timingStats)) {
    const driver = driverList[racingNumber]
    const speeds: Record<string, any> = line.BestSpeeds || {}

    let topSpeed = 0
    let speedTrap = 0

    for (const [key, speed] of Object.entries(speeds)) {
      const value = toNumber(speed.Value) || 0
      if (value > topSpeed) {
        topSpeed = value
      }
      if (key === "ST" || key === "SpeedTrap") {
        speedTrap = value
      }
    }

    if (topSpeed > 0) {
      allSpeeds.push({
        racingNumber,
        tla: driver?.Tla || "???",
        teamColour: driver?.TeamColour || "808080",
        topSpeed,
        speedTrap: speedTrap || topSpeed,
      })
    }
  }

  return allSpeeds.sort((a, b) => b.topSpeed - a.topSpeed)
}

export function parseTopThree(rawState: F1LiveTimingRawState): TopThreeData | null {
  const topThree = rawState.TopThree
  const driverList = rawState.DriverList || {}
  
  if (!topThree || !topThree.Lines) return null

  const entries = []

  for (const [racingNumber, line] of Object.entries(topThree.Lines)) {
    const driver = driverList[racingNumber]
    if (!driver) continue

    const position = toNumber(line.Position) || toNumber(line.Line) || 0
    if (position > 3) continue

    const lapTime = line.LapTime?.Value || line.BestLapTime?.Value || "—"
    const gap = line.Gap?.Value || line.IntervalToPositionAhead?.Value || "—"

    entries.push({
      racingNumber,
      tla: driver.Tla || "???",
      fullName: driver.FullName || "Unknown",
      teamColour: driver.TeamColour || "808080",
      position,
      lapTime,
      gap: position === 1 ? "—" : gap,
    })
  }

  return {
    entries: entries.sort((a, b) => a.position - b.position).slice(0, 3),
  }
}

export function parseLapSeries(rawState: F1LiveTimingRawState): DriverLapSeries[] {
  const lapSeriesRaw = rawState.LapSeries
  const driverList = rawState.DriverList || {}

  if (!lapSeriesRaw) return []

  const result: DriverLapSeries[] = []

  for (const [racingNumber, seriesData] of Object.entries(lapSeriesRaw)) {
    const driver = driverList[racingNumber]
    const lapPositionRaw = seriesData?.LapPosition
    const positions: string[] = Array.isArray(lapPositionRaw)
      ? lapPositionRaw.map((value: unknown) => String(value))
      : normalizeEntries<unknown>(lapPositionRaw).map((value) => String(value))

    if (positions.length === 0) continue

    const laps: Array<{ lap: number; position: number }> = positions.map((pos, idx) => ({
      lap: idx + 1,
      position: toNumber(pos) || 0,
    })).filter((p) => p.position > 0)

    if (laps.length === 0) continue

    result.push({
      racingNumber,
      tla: driver?.Tla || racingNumber,
      teamColour: driver?.TeamColour || "808080",
      laps,
    })
  }

  return result
}

export function parseRaceTraceSnapshot(rawState: F1LiveTimingRawState): DriverRaceTrace[] {
  const timingLines = rawState.TimingData?.Lines || {}
  const driverList = rawState.DriverList || {}
  const lapCount = toNumber(rawState.LapCount?.CurrentLap) || 0

  const parseGapToLeaderSeconds = (value: unknown): number | null => {
    if (typeof value !== "string") return null
    const cleaned = value.trim()
    if (!cleaned || cleaned === "—" || cleaned === "-") return null

    if (cleaned.includes(":")) {
      const ms = parseLapTimeToMs(cleaned)
      return ms ? ms / 1000 : null
    }

    const numericPart = cleaned.replace(/[^0-9.-]/g, "")
    const numericValue = Number(numericPart)
    return Number.isFinite(numericValue) ? Math.max(0, numericValue) : null
  }

  type SnapshotDriver = {
    racingNumber: string
    position: number
    lap: number
    gapToLeaderSeconds: number | null
    intervalToAheadSeconds: number | null
  }

  const snapshotDrivers: SnapshotDriver[] = []

  for (const [racingNumber, line] of Object.entries(timingLines)) {
    const position = toNumber((line as Record<string, any>).Position) || toNumber((line as Record<string, any>).Line) || 0
    if (position <= 0) continue

    const lap = toNumber((line as Record<string, any>).NumberOfLaps) || lapCount
    if (lap <= 0) continue

    const rawGapToLeader = (line as Record<string, any>).GapToLeader?.Value || (line as Record<string, any>).Gap?.Value
    const rawIntervalToAhead = (line as Record<string, any>).IntervalToPositionAhead?.Value

    snapshotDrivers.push({
      racingNumber,
      position,
      lap,
      gapToLeaderSeconds: position === 1 ? 0 : parseGapToLeaderSeconds(rawGapToLeader),
      intervalToAheadSeconds: parseGapToLeaderSeconds(rawIntervalToAhead),
    })
  }

  snapshotDrivers.sort((a, b) => a.position - b.position)

  let cumulativeGap = 0
  for (const driver of snapshotDrivers) {
    if (driver.position === 1) {
      driver.gapToLeaderSeconds = 0
      cumulativeGap = 0
      continue
    }

    if (driver.gapToLeaderSeconds !== null) {
      cumulativeGap = driver.gapToLeaderSeconds
      continue
    }

    if (driver.intervalToAheadSeconds !== null) {
      cumulativeGap += driver.intervalToAheadSeconds
      driver.gapToLeaderSeconds = cumulativeGap
    }
  }

  const traces: DriverRaceTrace[] = []

  for (const entry of snapshotDrivers) {
    const gapToLeaderSeconds = entry.gapToLeaderSeconds
    if (gapToLeaderSeconds === null) continue

    const driver = driverList[entry.racingNumber] || {}
    traces.push({
      racingNumber: entry.racingNumber,
      tla: driver.Tla || entry.racingNumber,
      teamColour: driver.TeamColour || "808080",
      points: [
        {
          lap: entry.lap,
          gapToLeaderSeconds,
        },
      ],
    })
  }

  return traces.sort((a, b) => {
    const aGap = a.points[0]?.gapToLeaderSeconds ?? Number.POSITIVE_INFINITY
    const bGap = b.points[0]?.gapToLeaderSeconds ?? Number.POSITIVE_INFINITY
    return aGap - bGap
  })
}

export function parseDriverLapHistory(rawState: F1LiveTimingRawState): DriverLapHistory[] {
  const timingLines = rawState.TimingData?.Lines || {}
  const timingAppLines = rawState.TimingAppData?.Lines || {}
  const lapSeries = parseLapSeries(rawState)

  const positionByDriver = new Map<string, Map<number, number>>()
  for (const driver of lapSeries) {
    const byLap = new Map<number, number>()
    for (const lap of driver.laps) {
      byLap.set(lap.lap, lap.position)
    }
    positionByDriver.set(driver.racingNumber, byLap)
  }

  const driverNumbers = new Set<string>([
    ...Object.keys(timingLines),
    ...Object.keys(timingAppLines),
    ...lapSeries.map((driver) => driver.racingNumber),
  ])

  const parseLapTimeValue = (value: unknown): string => {
    if (typeof value !== "string") return "—"
    const cleaned = value.trim()
    if (!cleaned) return "—"

    const lapMs = parseLapTimeToMs(cleaned)
    if (!lapMs) return "—"

    const MIN_VALID_LAP_MS = 45_000
    const MAX_VALID_LAP_MS = 180_000
    if (lapMs < MIN_VALID_LAP_MS || lapMs > MAX_VALID_LAP_MS) return "—"

    return cleaned
  }

  const parseLapNumber = (value: unknown): number | null => {
    const lap = toNumber(value)
    return lap && lap > 0 ? lap : null
  }

  const result: DriverLapHistory[] = []

  for (const racingNumber of driverNumbers) {
    const line = timingLines[racingNumber] as Record<string, any>
    const appLine = timingAppLines[racingNumber] as Record<string, any>
    const lapTimesByLap = new Map<number, string>()
    const lapTimePriorityByLap = new Map<number, number>()
    const lapTimeSourceByLap = new Map<number, "timingData" | "stint" | "lastLap" | "fallback">()
    const positionMap = positionByDriver.get(racingNumber) || new Map<number, number>()

    const setLapTime = (
      lapNumber: number,
      lapTime: string,
      priority: number,
      source: "timingData" | "stint" | "lastLap" | "fallback",
    ) => {
      if (lapTime === "—") return
      const currentPriority = lapTimePriorityByLap.get(lapNumber) || 0
      if (currentPriority > priority) return
      lapTimesByLap.set(lapNumber, lapTime)
      lapTimePriorityByLap.set(lapNumber, priority)
      lapTimeSourceByLap.set(lapNumber, source)
    }

    const applyLapEntry = (
      entry: Record<string, any>,
      priority: number,
      source: "timingData" | "stint" | "lastLap" | "fallback",
    ) => {
      if (!entry || typeof entry !== "object") return
      const lapNumber = parseLapNumber(entry.LapNumber ?? entry.Number ?? entry.Lap ?? entry.n)
      if (!lapNumber) return

      const lapTime = parseLapTimeValue(
        entry.LapTime?.Value ??
          entry.Time?.Value ??
          entry.LapTime ??
          entry.Time ??
          entry.Value,
      )

      setLapTime(lapNumber, lapTime, priority, source)
    }

    const lapCandidates = normalizeEntries<Record<string, any>>(line?.Laps ?? line?.LapTimes ?? line?.Stats?.Laps)
    for (const entry of lapCandidates) {
      applyLapEntry(entry, 3, "timingData")
    }

    const stintCandidates = normalizeEntries<Record<string, any>>(appLine?.Stints)
    for (const stint of stintCandidates) {
      const lapNumber = parseLapNumber(stint?.LapNumber)
      const lapTime = parseLapTimeValue(stint?.LapTime)
      if (lapNumber && lapTime !== "—") {
        setLapTime(lapNumber, lapTime, 2, "stint")
      }
    }

    const fallbackLapFromPositions = positionMap.size > 0
      ? Math.max(...Array.from(positionMap.keys()))
      : null
    const currentLapNumber = parseLapNumber(line?.NumberOfLaps) || fallbackLapFromPositions
    const lastLapTime = parseLapTimeValue(line?.LastLapTime?.Value)
    if (currentLapNumber && lastLapTime !== "—") {
      setLapTime(currentLapNumber, lastLapTime, 2, "lastLap")
    }

    if (line?.Stats && typeof line.Stats === "object") {
      for (const [key, value] of Object.entries(line.Stats as Record<string, any>)) {
        const numericKey = parseLapNumber(key)
        if (numericKey && value && typeof value === "object") {
          const lapTime = parseLapTimeValue(
            (value as Record<string, any>).LapTime?.Value ??
              (value as Record<string, any>).Time?.Value ??
              (value as Record<string, any>).LapTime ??
              (value as Record<string, any>).Time ??
              (value as Record<string, any>).Value,
          )
          setLapTime(numericKey, lapTime, 3, "timingData")
        } else {
          applyLapEntry(value, 3, "timingData")
        }
      }
    }

    const lapNumbers = lapTimesByLap.size > 0
      ? new Set<number>(Array.from(lapTimesByLap.keys()))
      : new Set<number>(Array.from(positionMap.keys()))

    const laps = Array.from(lapNumbers)
      .sort((a, b) => a - b)
      .map((lap) => ({
        lap,
        lapTime: lapTimesByLap.get(lap) || "—",
        lapTimeSource: lapTimeSourceByLap.get(lap) || "fallback",
        position: positionMap.get(lap) || 0,
      }))

    if (laps.length > 0) {
      result.push({ racingNumber, laps })
    }
  }

  return result
}

export function parseWeatherSeries(rawState: F1LiveTimingRawState): WeatherSeriesPoint[] {
  const series = rawState.WeatherDataSeries?.Series
  if (!Array.isArray(series) || series.length === 0) return []

  return series.map((entry: Record<string, any>) => {
    const w = entry.Weather || {}
    return {
      timestamp: entry.Timestamp || "",
      airTemp: parseFloat(w.AirTemp) || 0,
      trackTemp: parseFloat(w.TrackTemp) || 0,
      humidity: parseFloat(w.Humidity) || 0,
      windSpeed: parseFloat(w.WindSpeed) || 0,
      windDirection: parseFloat(w.WindDirection) || 0,
      pressure: parseFloat(w.Pressure) || 0,
      rainfall: parseFloat(w.Rainfall) || 0,
    }
  })
}

export function parsePitStopTimes(rawState: F1LiveTimingRawState): PitStopTime[] {
  const pitTimes = rawState.PitLaneTimeCollection?.PitTimes
  const driverList = rawState.DriverList || {}

  if (!pitTimes) return []

  const result: PitStopTime[] = []

  for (const [, pitData] of Object.entries(pitTimes)) {
    const racingNumber = String(pitData.RacingNumber || "")
    const driver = driverList[racingNumber]
    const duration = parseFloat(String(pitData.Duration || "0")) || 0

    if (duration <= 0) continue

    result.push({
      racingNumber,
      tla: driver?.Tla || racingNumber,
      teamColour: driver?.TeamColour || "808080",
      duration,
      lap: toNumber(pitData.Lap) || 0,
    })
  }

  return result.sort((a, b) => a.duration - b.duration)
}

export function parseDriverMiniSectors(rawState: F1LiveTimingRawState): DriverMiniSectors[] {
  const timingLines = rawState.TimingData?.Lines || {}
  const timingStatsLines = rawState.TimingStats?.Lines || {}
  const persistedBestByDriver = rawState.PersistedMiniSectorBest?.drivers || {}
  const driverList = rawState.DriverList || {}

  const result: DriverMiniSectors[] = []

  const mapSector = (s: Record<string, any>) => ({
    stopped: s?.Stopped === true,
    value: s?.Value || "",
    overallFastest: s?.OverallFastest === true,
    personalFastest: s?.PersonalFastest === true,
    segments: (Array.isArray(s?.Segments)
      ? s.Segments
      : Object.values(s?.Segments || {})
    ).map((seg: Record<string, any>) => ({ status: toNumber(seg?.Status) || 0 })),
  })

  const hasUsableBestSectorData = (sectors: Record<string, any>[]): boolean => {
    return sectors.some((sector) => {
      const value = typeof sector?.Value === "string" ? sector.Value.trim() : ""
      const segments = Array.isArray(sector?.Segments)
        ? sector.Segments
        : Object.values(sector?.Segments || {})
      return value.length > 0 || segments.length > 0
    })
  }

  for (const [racingNumber, line] of Object.entries(timingLines)) {
    const driver = driverList[racingNumber]
    const statsLine = (timingStatsLines as Record<string, any>)[racingNumber] || {}
    const rawSectors: Record<string, any>[] = Array.isArray(line.Sectors)
      ? line.Sectors
      : Object.values(line.Sectors || {})
    const timingDataBestSectors: Record<string, any>[] = Array.isArray((line as Record<string, any>).BestSectors)
      ? (line as Record<string, any>).BestSectors
      : Object.values((line as Record<string, any>).BestSectors || {})
    const timingStatsBestSectors: Record<string, any>[] = Array.isArray(statsLine.BestSectors)
      ? statsLine.BestSectors
      : Object.values(statsLine.BestSectors || {})
    const persistedBestSectors: Record<string, any>[] = Array.isArray((persistedBestByDriver as Record<string, any>)[racingNumber]?.sectors)
      ? (persistedBestByDriver as Record<string, any>)[racingNumber].sectors
      : []

    if (rawSectors.length === 0) continue

    const sectors = rawSectors.map(mapSector)
    const bestSectors =
      timingDataBestSectors.length > 0 && hasUsableBestSectorData(timingDataBestSectors)
        ? timingDataBestSectors.map(mapSector)
        : persistedBestSectors.length > 0 && hasUsableBestSectorData(persistedBestSectors)
          ? persistedBestSectors.map(mapSector)
        : timingStatsBestSectors.map((bestSector, index) => {
            const value = String(bestSector?.Value || "")
            const positionInSector = toNumber(bestSector?.Position) || 0
            const overallFastest = positionInSector === 1
            const hasValue = value.length > 0
            const segmentCount = (() => {
              const currentSegments = (rawSectors[index] as Record<string, any>)?.Segments
              if (Array.isArray(currentSegments) && currentSegments.length > 0) {
                return currentSegments.length
              }
              return 8
            })()

            return {
              stopped: false,
              value,
              overallFastest,
              personalFastest: hasValue && !overallFastest,
              segments: hasValue
                ? Array.from({ length: segmentCount }, () => ({
                    status: overallFastest ? 2051 : 2049,
                  }))
                : [],
            }
          })

    result.push({
      racingNumber,
      tla: driver?.Tla || racingNumber,
      teamColour: driver?.TeamColour || "808080",
      position: toNumber((line as Record<string, any>).Position) || toNumber((line as Record<string, any>).Line) || 99,
      inPit: (line as Record<string, any>).InPit === true,
      pitOut: (line as Record<string, any>).PitOut === true,
      sectors,
      bestSectors,
    })
  }

  return result
}

export function parseDriverSpeedTraps(rawState: F1LiveTimingRawState): DriverSpeedTraps[] {
  const timingLines = rawState.TimingData?.Lines || {}
  const driverList = rawState.DriverList || {}

  const result: DriverSpeedTraps[] = []

  const mapPoint = (raw: Record<string, any>) => {
    if (!raw || !raw.Value) return null
    return {
      value: String(raw.Value),
      overallFastest: raw.OverallFastest === true,
      personalFastest: raw.PersonalFastest === true,
    }
  }

  for (const [racingNumber, line] of Object.entries(timingLines)) {
    const driver = driverList[racingNumber]
    const speeds = line.Speeds || {}

    result.push({
      racingNumber,
      tla: driver?.Tla || racingNumber,
      teamColour: driver?.TeamColour || "808080",
      i1: mapPoint(speeds.I1),
      i2: mapPoint(speeds.I2),
      fl: mapPoint(speeds.FL),
      st: mapPoint(speeds.ST),
    })
  }

  return result.filter((d) => d.i1 || d.i2 || d.fl || d.st)
}

export function parseChampionshipPrediction(rawState: F1LiveTimingRawState): ChampionshipPredictionEntry[] {
  const prediction = rawState.ChampionshipPrediction
  const driverList = rawState.DriverList || {}

  if (!prediction) return []

  const drivers = prediction.Drivers || prediction.drivers || {}
  const result: ChampionshipPredictionEntry[] = []

  for (const [racingNumber, data] of Object.entries(drivers)) {
    const driver = driverList[racingNumber]
    const current = toNumber((data as Record<string, any>).CurrentPoints ?? (data as Record<string, any>).Points) || 0
    const predicted = toNumber((data as Record<string, any>).PredictedPoints ?? (data as Record<string, any>).Predicted) || 0

    result.push({
      racingNumber,
      tla: driver?.Tla || racingNumber,
      teamColour: driver?.TeamColour || "808080",
      currentPoints: current,
      predictedPoints: predicted,
      deltaPoints: predicted - current,
    })
  }

  return result.sort((a, b) => b.predictedPoints - a.predictedPoints)
}

function normalizeStreamArray(raw: unknown): any[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : Object.values(raw)
}

function parseStreamList(raw: unknown): ContentStream[] {
  const streamSource = (raw as any)?.Streams ?? (raw as any)?.streams ?? raw
  const streams = normalizeStreamArray(streamSource)
  return streams.map((s: Record<string, any>) => ({
    name: String(s.Name ?? s.name ?? ""),
    type: String(s.Type ?? s.type ?? ""),
    language: String(s.Language ?? s.language ?? ""),
    uri: String(s.Uri ?? s.uri ?? s.Url ?? s.url ?? s.Path ?? s.path ?? ""),
    utc: String(s.Utc ?? s.utc ?? ""),
  })).filter((s) => s.uri && s.uri !== "null" && s.uri !== "undefined")
}

export function parseSessionData(rawState: F1LiveTimingRawState): SessionDataParsed {
  const contentStreams = parseStreamList(rawState.ContentStreams)
  const audioStreams = parseStreamList(rawState.AudioStreams)

  const sd = rawState.SessionData
  const series = normalizeStreamArray(sd?.Series)
  const statusSeries = normalizeStreamArray(sd?.StatusSeries)

  const qualifyingParts = series
    .filter((e: Record<string, any>) => e.QualifyingPart !== undefined)
    .map((e: Record<string, any>) => ({ part: toNumber(e.QualifyingPart) || 0, utc: String(e.Utc || "") }))

  const timeline: SessionTimelineEvent[] = []

  for (const e of statusSeries) {
    if (e.TrackStatus) {
      timeline.push({ utc: String(e.Utc || ""), kind: "TrackStatus", value: String(e.TrackStatus) })
    }
    if (e.SessionStatus) {
      timeline.push({ utc: String(e.Utc || ""), kind: "SessionStatus", value: String(e.SessionStatus) })
    }
  }

  for (const qp of qualifyingParts) {
    timeline.push({ utc: qp.utc, kind: "QualifyingPart", value: `Q${qp.part}` })
  }

  timeline.sort((a, b) => new Date(a.utc).getTime() - new Date(b.utc).getTime())

  return { streams: contentStreams, audioStreams, timeline, qualifyingParts }
}

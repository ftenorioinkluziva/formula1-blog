const BASE_URL = "https://api.jolpi.ca/ergast/f1"

/* ---------- Response types (Ergast-compatible) ---------- */

export interface JolpicaDriver {
  driverId: string
  permanentNumber: string
  code: string
  url?: string
  givenName: string
  familyName: string
  dateOfBirth?: string
  nationality: string
}

export interface JolpicaConstructor {
  constructorId: string
  name: string
  nationality: string
}

export interface JolpicaDriverStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Driver: JolpicaDriver
  Constructors: JolpicaConstructor[]
}

export interface JolpicaConstructorStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Constructor: JolpicaConstructor
}

export interface JolpicaRaceResult {
  number: string
  position: string
  positionText: string
  points: string
  Driver: JolpicaDriver
  Constructor: JolpicaConstructor
  grid: string
  laps: string
  status: string
  Time?: { millis: string; time: string }
  FastestLap?: { rank: string; lap: string; Time: { time: string } }
}

export interface JolpicaRace {
  season: string
  round: string
  raceName: string
  Results: JolpicaRaceResult[]
}

export interface JolpicaQualifyingResult {
  number: string
  position: string
  Driver: JolpicaDriver
  Constructor: JolpicaConstructor
  Q1?: string
  Q2?: string
  Q3?: string
}

export interface JolpicaQualifyingRace {
  season: string
  round: string
  raceName: string
  QualifyingResults: JolpicaQualifyingResult[]
}

/* ---------- Fetch helpers ---------- */

async function jolpicaFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    }

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      })

      if (res.status === 429) {
        lastError = new Error(`Rate limited (429) from Jolpica API: ${url}`)
        continue
      }

      if (!res.ok) {
        throw new Error(`Jolpica API ${res.status}: ${url}`)
      }

      const json = await res.json()
      return json.MRData as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (err instanceof Error && err.name === "AbortError") {
        continue
      }

      if (attempt < 3) {
        continue
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`)
}

/* ---------- Public API ---------- */

interface DriverStandingsResponse {
  StandingsTable: {
    season: string
    StandingsLists: Array<{
      season: string
      round: string
      DriverStandings: JolpicaDriverStanding[]
    }>
  }
}

interface ConstructorStandingsResponse {
  StandingsTable: {
    season: string
    StandingsLists: Array<{
      season: string
      round: string
      ConstructorStandings: JolpicaConstructorStanding[]
    }>
  }
}

interface RaceResultsResponse {
  RaceTable: {
    season: string
    round: string
    Races: JolpicaRace[]
  }
}

export async function fetchDriverStandings(season: number): Promise<JolpicaDriverStanding[]> {
  const data = await jolpicaFetch<DriverStandingsResponse>(`/${season}/driverstandings.json?limit=100`)
  return data.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
}

export async function fetchConstructorStandings(season: number): Promise<JolpicaConstructorStanding[]> {
  const data = await jolpicaFetch<ConstructorStandingsResponse>(`/${season}/constructorstandings.json?limit=100`)
  return data.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
}

export async function fetchRaceResults(season: number, round: number): Promise<JolpicaRace | null> {
  const data = await jolpicaFetch<RaceResultsResponse>(`/${season}/${round}/results.json?limit=100`)
  return data.RaceTable.Races[0] ?? null
}

interface QualifyingResponse {
  RaceTable: {
    season: string
    round: string
    Races: JolpicaQualifyingRace[]
  }
}

export async function fetchQualifyingResults(season: number, round: number): Promise<JolpicaQualifyingRace | null> {
  const data = await jolpicaFetch<QualifyingResponse>(`/${season}/${round}/qualifying.json?limit=100`)
  return data.RaceTable.Races[0] ?? null
}

interface SprintResponse {
  RaceTable: {
    season: string
    round: string
    Races: Array<{
      season: string
      round: string
      raceName: string
      SprintResults: JolpicaRaceResult[]
    }>
  }
}

export async function fetchSprintResults(season: number, round: number): Promise<JolpicaRaceResult[] | null> {
  const data = await jolpicaFetch<SprintResponse>(`/${season}/${round}/sprint.json?limit=100`)
  const race = data.RaceTable.Races[0]
  return race ? race.SprintResults : null
}

/* ---------- Lap timings ---------- */

export interface JolpicaLapTiming {
  driverId: string
  position: string
  time: string
}

export interface JolpicaLap {
  number: string
  Timings: JolpicaLapTiming[]
}

interface LapsResponse {
  RaceTable: {
    season: string
    round: string
    Races: Array<{ Laps: JolpicaLap[] }>
  }
  total: string
}

export async function fetchAllLaps(season: number, round: number): Promise<JolpicaLap[]> {
  const PAGE_SIZE = 100
  const allLaps: JolpicaLap[] = []
  let offset = 0

  const first = await jolpicaFetch<LapsResponse>(`/${season}/${round}/laps.json?limit=${PAGE_SIZE}&offset=0`)
  const total = Number(first.total) || 0
  const firstRace = first.RaceTable.Races[0]

  if (!firstRace || firstRace.Laps.length === 0) {
    return []
  }

  allLaps.push(...firstRace.Laps)
  offset = PAGE_SIZE

  while (offset < total) {
    const page = await jolpicaFetch<LapsResponse>(`/${season}/${round}/laps.json?limit=${PAGE_SIZE}&offset=${offset}`)
    const race = page.RaceTable.Races[0]
    if (!race || race.Laps.length === 0) break
    allLaps.push(...race.Laps)
    offset += PAGE_SIZE
  }

  return mergeLaps(allLaps)
}

function mergeLaps(laps: JolpicaLap[]): JolpicaLap[] {
  const map = new Map<string, JolpicaLapTiming[]>()
  for (const lap of laps) {
    const existing = map.get(lap.number)
    if (existing) {
      existing.push(...lap.Timings)
    } else {
      map.set(lap.number, [...lap.Timings])
    }
  }
  return Array.from(map.entries()).map(([number, Timings]) => ({ number, Timings }))
}

/* ---------- Pit stops ---------- */

export interface JolpicaPitStop {
  driverId: string
  lap: string
  stop: string
  time: string
  duration: string
}

interface PitStopsResponse {
  RaceTable: {
    season: string
    round: string
    Races: Array<{ PitStops: JolpicaPitStop[] }>
  }
}

export async function fetchPitStops(season: number, round: number): Promise<JolpicaPitStop[]> {
  const data = await jolpicaFetch<PitStopsResponse>(`/${season}/${round}/pitstops.json?limit=100`)
  return data.RaceTable.Races[0]?.PitStops ?? []
}

/* ---------- Season schedule (for circuits) ---------- */

export interface JolpicaCircuit {
  circuitId: string
  url: string
  circuitName: string
  Location: {
    lat: string
    long: string
    locality: string
    country: string
  }
}

export interface JolpicaScheduleRace {
  season: string
  round: string
  raceName: string
  Circuit: JolpicaCircuit
}

interface ScheduleResponse {
  RaceTable: {
    season: string
    Races: JolpicaScheduleRace[]
  }
}

export async function fetchSeasonSchedule(season: number): Promise<JolpicaScheduleRace[]> {
  const data = await jolpicaFetch<ScheduleResponse>(`/${season}.json?limit=100`)
  return data.RaceTable.Races ?? []
}

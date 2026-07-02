const BASE_URL = "https://api.openf1.org/v1"

const COUNTRY_ALIASES: Record<string, string[]> = {
  usa: ["United States"],
  "great britain": ["United Kingdom"],
  "abu dhabi": ["United Arab Emirates"],
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function getCountryCandidates(countryName: string): string[] {
  const normalized = normalizeText(countryName)
  return Array.from(new Set([countryName, ...(COUNTRY_ALIASES[normalized] ?? [])]))
}

function scoreSessionMatch(
  session: OpenF1Session,
  targetStartUtc?: Date,
  circuitName?: string,
): number {
  let score = 0

  if (targetStartUtc) {
    score += Math.abs(new Date(session.date_start).getTime() - targetStartUtc.getTime())
  }

  if (circuitName) {
    const normalizedCircuit = normalizeText(circuitName)
    const normalizedShortName = normalizeText(session.circuit_short_name)

    if (normalizedCircuit === normalizedShortName) {
      score -= 1_000_000_000
    } else if (
      normalizedCircuit.includes(normalizedShortName)
      || normalizedShortName.includes(normalizedCircuit)
    ) {
      score -= 500_000_000
    }
  }

  return score
}

function isOpenF1NoResultsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("responded 404")
}

async function fetchJson<T>(path: string, params: Record<string, string | number>, retries = 3): Promise<T[]> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(10_000) })

    if (res.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt + 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      continue
    }

    if (!res.ok) {
      throw new Error(`OpenF1 ${path} responded ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<T[]>
  }

  throw new Error(`OpenF1 ${path} failed after ${retries} retries`)
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  meeting_key: number
  circuit_short_name: string
  country_name: string
  date_start: string
  date_end: string
  year: number
}

interface FindSessionOptions {
  year: number
  sessionName: string
  countryName: string
  circuitName?: string
  startTimeUtc?: Date
}

export interface OpenF1Stint {
  session_key: number
  driver_number: number
  stint_number: number
  compound: string
  lap_start: number
  lap_end: number
  tyre_age_at_start: number
  meeting_key: number
}

export interface OpenF1Lap {
  session_key: number
  driver_number: number
  lap_number: number
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  i1_speed: number | null
  i2_speed: number | null
  st_speed: number | null
  is_pit_out_lap: boolean
  date_start: string
  meeting_key: number
}

export interface OpenF1Weather {
  session_key: number
  meeting_key: number
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  pressure: number
  rainfall: number
  wind_direction: number
  wind_speed: number
}

export interface OpenF1Pit {
  session_key: number
  driver_number: number
  lap_number: number
  stop_duration: number | null
  lane_duration: number | null
  pit_duration: number | null
  date: string
  meeting_key: number
}

export interface OpenF1Driver {
  session_key: number
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  meeting_key: number
}

export async function fetchSessions(year: number, countryName?: string): Promise<OpenF1Session[]> {
  const params: Record<string, string | number> = { year }
  if (countryName) params.country_name = countryName
  return fetchJson<OpenF1Session>("/sessions", params)
}

export async function findSession(
  options: FindSessionOptions,
): Promise<OpenF1Session | null> {
  const { year, sessionName, countryName, circuitName, startTimeUtc } = options

  const candidates: OpenF1Session[] = []

  for (const candidateCountry of getCountryCandidates(countryName)) {
    try {
      const sessions = await fetchSessions(year, candidateCountry)
      candidates.push(...sessions.filter((session) => session.session_name === sessionName))
    } catch (error) {
      if (isOpenF1NoResultsError(error)) {
        continue
      }

      throw error
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => {
    const leftScore = scoreSessionMatch(left, startTimeUtc, circuitName)
    const rightScore = scoreSessionMatch(right, startTimeUtc, circuitName)
    return leftScore - rightScore
  })

  return candidates[0] ?? null
}

export async function findRaceSessionKey(year: number, countryName: string): Promise<number | null> {
  const race = await findSession({ year, sessionName: "Race", countryName })
  return race?.session_key ?? null
}

export async function findQualifyingSessionKey(
  year: number,
  countryName: string,
  circuitName?: string,
  startTimeUtc?: Date,
): Promise<number | null> {
  const quali = await findSession({
    year,
    sessionName: "Qualifying",
    countryName,
    circuitName,
    startTimeUtc,
  })
  return quali?.session_key ?? null
}

export async function fetchStints(sessionKey: number): Promise<OpenF1Stint[]> {
  return fetchJson<OpenF1Stint>("/stints", { session_key: sessionKey })
}

export async function fetchLaps(sessionKey: number, driverNumber?: number): Promise<OpenF1Lap[]> {
  const params: Record<string, string | number> = { session_key: sessionKey }
  if (driverNumber) params.driver_number = driverNumber
  return fetchJson<OpenF1Lap>("/laps", params)
}

export async function fetchWeather(sessionKey: number): Promise<OpenF1Weather[]> {
  return fetchJson<OpenF1Weather>("/weather", { session_key: sessionKey })
}

export async function fetchPitData(sessionKey: number): Promise<OpenF1Pit[]> {
  return fetchJson<OpenF1Pit>("/pit", { session_key: sessionKey })
}

export async function fetchDrivers(sessionKey: number): Promise<OpenF1Driver[]> {
  return fetchJson<OpenF1Driver>("/drivers", { session_key: sessionKey })
}

export interface OpenF1RaceControl {
  session_key: number
  date: string
  lap_number: number | null
  category: string
  flag: string | null
  message: string
  scope: string | null
  sector: number | null
  driver_number: number | null
  meeting_key: number
}

export async function fetchRaceControl(sessionKey: number): Promise<OpenF1RaceControl[]> {
  return fetchJson<OpenF1RaceControl>("/race_control", { session_key: sessionKey })
}

export interface OpenF1Interval {
  session_key: number
  driver_number: number
  date: string
  gap_to_leader: number | null
  interval: number | null
  meeting_key: number
}

export async function fetchIntervals(sessionKey: number): Promise<OpenF1Interval[]> {
  return fetchJson<OpenF1Interval>("/intervals", { session_key: sessionKey })
}

export interface OpenF1CarData {
  session_key: number
  driver_number: number
  date: string
  speed: number
  throttle: number
  brake: number
  rpm: number
  n_gear: number
  drs: number
  meeting_key: number
}

export async function fetchCarData(sessionKey: number, driverNumber: number): Promise<OpenF1CarData[]> {
  return fetchJson<OpenF1CarData>("/car_data", { session_key: sessionKey, driver_number: driverNumber })
}

export interface OpenF1TeamRadio {
  session_key: number
  driver_number: number
  date: string
  recording_url: string
  meeting_key: number
}

export async function fetchTeamRadio(sessionKey: number): Promise<OpenF1TeamRadio[]> {
  return fetchJson<OpenF1TeamRadio>("/team_radio", { session_key: sessionKey })
}

export interface OpenF1Location {
  session_key: number
  driver_number: number
  date: string
  x: number
  y: number
  z: number
  meeting_key: number
}

export async function fetchLocations(sessionKey: number, driverNumber?: number): Promise<OpenF1Location[]> {
  const params: Record<string, string | number> = { session_key: sessionKey }
  if (driverNumber) params.driver_number = driverNumber
  return fetchJson<OpenF1Location>("/location", params)
}

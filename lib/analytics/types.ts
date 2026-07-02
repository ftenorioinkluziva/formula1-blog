export interface DriverInfo {
  id: number
  code: string
  fullName: string
  number: number
  teamName: string
  teamColor: string
}

export interface RacePaceLap {
  driverId: number
  driverCode: string
  teamColor: string
  lapNumber: number
  lapTimeMs: number
  pitIn: boolean
  pitOut: boolean
  compound: string | null
}

export interface RacePacePitStop {
  driverId: number
  driverCode: string
  lap: number
  stopNumber: number
  durationMs: number | null
}

export interface TireStintInfo {
  driverId: number
  driverCode: string
  stintNumber: number
  compound: string
  lapStart: number
  lapEnd: number
  tyreAgeAtStart: number
}

export interface RaceControlEvent {
  lap: number
  flag: string
  messageType: string
  message: string
  occurredAtUtc: string
}

export interface TeamRadioMessage {
  driverCode: string
  teamColor: string
  lap: number | null
  recordingUrl: string
  occurredAtUtc: string
}

export interface RacePaceResponse {
  sessionId: number
  totalLaps: number
  drivers: DriverInfo[]
  laps: RacePaceLap[]
  pitStops: RacePacePitStop[]
  stints: TireStintInfo[]
  raceControlEvents: RaceControlEvent[]
  teamRadio: TeamRadioMessage[]
}

export interface GridVsFinishEntry {
  driverId: number
  driverCode: string
  fullName: string
  teamColor: string
  gridPosition: number
  finishPosition: number
  positionsGained: number
  status: string
}

export interface GridVsFinishResponse {
  sessionId: number
  results: GridVsFinishEntry[]
}

export interface PitStrategyStop {
  lap: number
  stopNumber: number
  durationMs: number | null
}

export interface PitStrategyDriver {
  driverId: number
  driverCode: string
  fullName: string
  teamColor: string
  finishPosition: number
  stops: PitStrategyStop[]
  stints: Array<{ startLap: number; endLap: number; laps: number; compound: string | null }>
}

export interface PitStrategyResponse {
  sessionId: number
  totalLaps: number
  drivers: PitStrategyDriver[]
}

export interface QualifyingEntry {
  driverId: number
  driverCode: string
  fullName: string
  teamColor: string
  position: number
  q1TimeMs: number | null
  q2TimeMs: number | null
  q3TimeMs: number | null
  gapToPoleMs: number | null
}

export interface QualifyingResponse {
  sessionId: number
  results: QualifyingEntry[]
}

export interface ChampionshipPoint {
  round: number
  grandPrixName: string
  points: number
  cumulative: number
}

export interface ChampionshipProgression {
  id: number
  code: string
  name: string
  color: string
  pointsByRound: ChampionshipPoint[]
}

export interface ChampionshipResponse {
  season: number
  type: "drivers" | "constructors"
  rounds: Array<{ round: number; grandPrixName: string }>
  progressions: ChampionshipProgression[]
}

export interface TeammateH2HTeam {
  teamName: string
  teamColor: string
  driver1: { code: string; fullName: string }
  driver2: { code: string; fullName: string }
  qualiBattle: [number, number]
  raceBattle: [number, number]
  avgQualiGapMs: number | null
  pointsDelta: number
}

export interface TeammateH2HResponse {
  season: number
  teams: TeammateH2HTeam[]
}

export interface ReliabilityEntry {
  driverCode: string
  fullName: string
  teamColor: string
  dnfCount: number
  dnfsByType: Record<string, number>
}

export interface ReliabilityResponse {
  season: number
  drivers: ReliabilityEntry[]
}

export interface RaceWeekendOption {
  round: number
  grandPrixName: string
  country: string
  hasResults: boolean
}

export interface RaceWeekendListResponse {
  season: number
  weekends: RaceWeekendOption[]
}

export interface GapEvolutionLap {
  driverId: number
  driverCode: string
  teamColor: string
  lapNumber: number
  gapToLeader: number | null
}

export interface GapEvolutionResponse {
  sessionId: number
  totalLaps: number
  drivers: DriverInfo[]
  gaps: GapEvolutionLap[]
  raceControlEvents: RaceControlEvent[]
}

export interface TelemetrySample {
  sampleIndex: number
  speed: number
  throttle: number
  brake: number
  rpm: number
  gear: number
  drs: number
  relativeMs: number | null
}

export interface PoleXRayResponse {
  sessionId: number
  driverCode: string
  driverFullName: string
  teamColor: string
  lapNumber: number
  lapTimeMs: number | null
  sector1Ms: number | null
  sector2Ms: number | null
  sector3Ms: number | null
  telemetry: TelemetrySample[]
}

export interface ReplayPosition {
  driverCode: string
  teamColor: string
  x: number
  y: number
}

export interface ReplayFrame {
  lap: number
  positions: ReplayPosition[]
}

export interface RaceReplayResponse {
  totalFrames: number
  lapStart: number
  lapEnd: number
  frames: ReplayFrame[]
  drivers: Array<{ code: string; teamColor: string }>
}

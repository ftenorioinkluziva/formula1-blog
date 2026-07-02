/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Driver {
  pos: number
  racingNumber: string
  tla: string
  fullName: string
  teamName: string
  teamColour: string
  bestLap: string
  lastLap: string
  gap: string
  compound: string
  isNew: boolean
  tyreLaps: number
  inPit: boolean
  pitOut: boolean
  knockedOut: boolean
}

export interface RaceMessage {
  utc: string
  lap?: number
  category: string
  message: string
  status?: string
  flag?: string
  scope?: string
  sector?: number
  racingNumber?: string
}

export interface RadioCapture {
  utc: string
  racingNumber: string
  path: string
}

export interface WeatherData {
  airTemp: string
  trackTemp: string
  humidity: string
  pressure: string
  rainfall: string
  windDirection: string
  windSpeed: string
}

export interface SessionInfo {
  name: string
  circuit: string
  country: string
  type: string
  part?: number | null
  path?: string
}

export interface SessionState {
  status: string
  extrapolating: boolean
  remaining: string
  utc?: string
}

export interface LiveTimingClock {
  paused: boolean
  systemTime: number
  trackTime: number
  liveTimingStartTime: number
}

export interface TrackState {
  status: string
  message: string
}

export interface LapCountData {
  currentLap: number
  totalLaps: number
}

export interface DriverPosition {
  racingNumber: string
  x: number
  y: number
  z: number
  status: string
}

export interface PositionData {
  entries: DriverPosition[]
}

export interface SectorTime {
  sector1: string
  sector2: string
  sector3: string
}

export interface TimingStatsData {
  bestLapTime: string
  bestLapDriver: string
  bestSectors: SectorTime
  topSpeed: number
  topSpeedDriver: string
}

export interface TireStint {
  compound: string
  isNew: boolean
  totalLaps: number
  startLap: number
  stintNumber: number
}

export interface DriverStints {
  racingNumber: string
  stints: TireStint[]
}

export interface DriverSectors {
  racingNumber: string
  tla: string
  teamColour: string
  sectors: SectorTime
  bestLapTime: string
}

export interface DriverSpeed {
  racingNumber: string
  tla: string
  teamColour: string
  topSpeed: number
  speedTrap: number
}

export interface TopThreeEntry {
  racingNumber: string
  tla: string
  fullName: string
  teamColour: string
  position: number
  lapTime: string
  gap: string
}

export interface TopThreeData {
  entries: TopThreeEntry[]
}

export interface SessionInfoDetailed {
  name: string
  circuit: string
  country: string
  type: string
  part?: number | null
  gp?: string
  location?: string
  date?: string
}

export interface LapPositionPoint {
  lap: number
  position: number
}

export interface DriverLapSeries {
  racingNumber: string
  tla: string
  teamColour: string
  laps: LapPositionPoint[]
}

export interface RaceTracePoint {
  lap: number
  gapToLeaderSeconds: number
}

export interface DriverRaceTrace {
  racingNumber: string
  tla: string
  teamColour: string
  points: RaceTracePoint[]
}

export interface DriverLapDetail {
  lap: number
  lapTime: string
  lapTimeSource: "timingData" | "stint" | "lastLap" | "fallback"
  position: number
}

export interface DriverLapHistory {
  racingNumber: string
  laps: DriverLapDetail[]
}

export interface WeatherSeriesPoint {
  timestamp: string
  airTemp: number
  trackTemp: number
  humidity: number
  windSpeed: number
  windDirection: number
  pressure: number
  rainfall: number
}

export interface PitStopTime {
  racingNumber: string
  tla: string
  teamColour: string
  duration: number
  lap: number
}

export interface MiniSegment {
  status: number
}

export interface DriverSectorMini {
  stopped: boolean
  value: string
  overallFastest: boolean
  personalFastest: boolean
  segments: MiniSegment[]
}

export interface DriverMiniSectors {
  racingNumber: string
  tla: string
  teamColour: string
  position: number
  inPit: boolean
  pitOut: boolean
  sectors: DriverSectorMini[]
  bestSectors: DriverSectorMini[]
}

export interface SpeedTrapPoint {
  value: string
  overallFastest: boolean
  personalFastest: boolean
}

export interface DriverSpeedTraps {
  racingNumber: string
  tla: string
  teamColour: string
  i1: SpeedTrapPoint | null
  i2: SpeedTrapPoint | null
  fl: SpeedTrapPoint | null
  st: SpeedTrapPoint | null
}

export interface ChampionshipPredictionEntry {
  racingNumber: string
  tla: string
  teamColour: string
  currentPoints: number
  predictedPoints: number
  deltaPoints: number
}

export interface DriverTimingStats {
  racingNumber: string
  sector1: string
  sector2: string
  sector3: string
  topSpeed: string
}

export interface ContentStream {
  name: string
  type: string
  language: string
  uri: string
  utc: string
}

export interface SessionTimelineEvent {
  utc: string
  kind: "TrackStatus" | "SessionStatus" | "QualifyingPart"
  value: string
}

export interface SessionDataParsed {
  streams: ContentStream[]
  audioStreams: ContentStream[]
  timeline: SessionTimelineEvent[]
  qualifyingParts: Array<{ part: number; utc: string }>
}

export interface LiveTimingState {
  drivers: Driver[]
  weather: WeatherData | null
  session: SessionInfo | null
  sessionState: SessionState | null
  liveTimingClock: LiveTimingClock | null
  trackStatus: TrackState | null
  raceMessages: RaceMessage[]
  radioCaptures: RadioCapture[]
  selectedDriverNumber: string | null
  driverInfoMap: Record<string, { fullName: string; teamName: string; teamColour: string }>
  lapCount: LapCountData | null
  positions: PositionData | null
  timingStats: TimingStatsData | null
  driverTimingStats: DriverTimingStats[]
  topThree: TopThreeData | null
}

type RawRecord = Record<string, any>

export interface F1LiveTimingRawState {
  DriverList?: RawRecord
  TimingData?: { Lines?: RawRecord; [k: string]: unknown }
  TimingAppData?: { Lines?: RawRecord; [k: string]: unknown }
  TimingStats?: { Lines?: RawRecord; [k: string]: unknown }
  WeatherData?: RawRecord
  WeatherDataSeries?: RawRecord
  SessionInfo?: RawRecord
  SessionStatus?: RawRecord
  ExtrapolatedClock?: RawRecord
  TopThree?: { Lines?: RawRecord; [k: string]: unknown }
  TrackStatus?: RawRecord
  RaceControlMessages?: { Messages?: RawRecord; [k: string]: unknown }
  TeamRadio?: { Captures?: RawRecord; [k: string]: unknown }
  LapCount?: RawRecord
  LapSeries?: RawRecord
  Position?: RawRecord
  PitLaneTimeCollection?: { PitTimes?: RawRecord; [k: string]: unknown }
  ChampionshipPrediction?: RawRecord | null
  ContentStreams?: RawRecord | null
  AudioStreams?: RawRecord | null
  SessionData?: RawRecord | null
  LiveTimingClock?: RawRecord | null
  PersistedMiniSectorBest?: {
    sessionId: string | null
    updatedAtIso: string | null
    drivers: Record<string, { racingNumber: string; bestLapMs: number; sectors: Array<{
      stopped: boolean
      value: string
      overallFastest: boolean
      personalFastest: boolean
      segments: Array<{ status: number }>
    }> }>
  } | null
}

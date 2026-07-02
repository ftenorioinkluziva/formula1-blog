export const DEFAULT_SIGNALR_HUB_URL = 'https://livetiming.formula1.com/signalrcore'
export const SIGNALR_HUB_URL = process.env.SIGNALR_HUB_URL || DEFAULT_SIGNALR_HUB_URL

export const SIGNALR_TOPICS = [
  'Heartbeat',
  'ExtrapolatedClock',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
  'TeamRadio',
  'CarData.z',
  'Position.z',
  'ChampionshipPrediction',
  'PitLaneTimeCollection',
  'PitStopSeries',
] as const

export type SignalRTopic = (typeof SIGNALR_TOPICS)[number]

export const COMPRESSED_TOPICS = new Set(['CarData.z', 'Position.z'])

export function getCleanTopicName(topic: string): string {
  return topic.replace(/\.z$/, '')
}

export const TOPICS_REQUIRING_SUBSCRIPTION = new Set([
  'CarData.z',
  'Position.z',
  'ChampionshipPrediction',
  'PitLaneTimeCollection',
  'PitStopSeries',
])

export const TOPIC_TO_RAW_STATE_KEY: Record<string, string> = {
  Heartbeat: 'Heartbeat',
  ExtrapolatedClock: 'ExtrapolatedClock',
  TimingStats: 'TimingStats',
  TimingAppData: 'TimingAppData',
  WeatherData: 'WeatherData',
  TrackStatus: 'TrackStatus',
  DriverList: 'DriverList',
  RaceControlMessages: 'RaceControlMessages',
  SessionInfo: 'SessionInfo',
  SessionData: 'SessionData',
  LapCount: 'LapCount',
  TimingData: 'TimingData',
  TeamRadio: 'TeamRadio',
  'CarData.z': 'CarData',
  'Position.z': 'Position',
  ChampionshipPrediction: 'ChampionshipPrediction',
  PitLaneTimeCollection: 'PitLaneTimeCollection',
  PitStopSeries: 'PitStopSeries',
}

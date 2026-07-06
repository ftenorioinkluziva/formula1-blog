import { EditorialAssignment } from "@/lib/db/schema"

export type AssignmentType =
  | "race_result"
  | "qualifying_result"
  | "sprint_result"
  | "race_preview"
  | "weekend_preview"
  | "technical_analysis"
  | "strategy_analysis"
  | "paddock_roundup"
  | "daily_news_roundup"
  | "topic_feature"

export type EditorialDesk =
  | "Noticias"
  | "Resultado GP"
  | "Resultado Qualifying"
  | "Raio-X Tecnico"
  | "O Debate na Pista"
  | "Giro pelo Paddock"
  | "Preview"

export interface SourcePacketAssignmentInfo {
  id: number
  source: string
  rawInput: string
  topicCanonical: string
  assignmentType: AssignmentType
  editorialDesk: EditorialDesk
  season: number | null
  round: number | null
  sessionId: number | null
  status: string
  locale: string
}

export interface SourcePacketEventInfo {
  season: number
  round: number
  grandPrixName: string
  circuit: string
  country: string
  location: string
}

export interface SourcePacketOfficialResultRow {
  position: number
  driverFullName: string
  driverCode: string
  driverNumber: number
  teamName: string
  teamColor: string
  gridPosition: number | null
  lapsCompleted: number | null
  status: string
  points: number
  fastestLapRank: number | null
  bestLapTime: string | null
}

export interface SourcePacketStandingsRow {
  position: number
  name: string
  code?: string
  points: number
  wins: number
}

export interface SourcePacketSportingContext {
  driverStandings: SourcePacketStandingsRow[]
  constructorStandings: SourcePacketStandingsRow[]
  raceControlMessages: {
    messageType: string
    flag: string
    lap: number
    messageText: string
    racingNumber: string
    occurredAtUtc: string
  }[]
}

export interface SourcePacketPerformanceContext {
  pitStops: {
    driverCode: string
    lap: number
    stopNumber: number
    duration: string | null
  }[]
  tireStints: {
    driverCode: string
    stintNumber: number
    compound: string
    lapStart: number
    lapEnd: number
    tyreAgeAtStart: number
  }[]
  weatherSamples: {
    airTemperature: number | null
    trackTemperature: number | null
    humidity: number | null
    rainfall: boolean
    windSpeed: number | null
    recordedAtUtc: string
  }[]
}

export interface SourcePacketNewsItem {
  source: string
  title: string
  date: string
  url: string
  excerpt: string
  author: string
  readTime: string
  body: string[]
}

export interface SourcePacketMediaItem {
  imageUrl: string
  fileName: string | null
  galleryTitle: string
  folderKey: string | null
  relatedSeason: number | null
  relatedRound: number | null
  relatedSessionType: string | null
  matchSignals: string[]
  relevanceScore: number
}

export interface SourcePacketCoverageContext {
  publishedArticles: {
    id: number
    title: string
    excerpt: string
    category: string
    date: string
  }[]
  pendingArticles: {
    id: number
    title: string
    excerpt: string
    category: string
    date: string
  }[]
}

export interface SourcePacket {
  assignment: SourcePacketAssignmentInfo
  event: SourcePacketEventInfo | null
  officialResults: SourcePacketOfficialResultRow[]
  sportingContext: SourcePacketSportingContext
  performanceContext: SourcePacketPerformanceContext
  recentNews: SourcePacketNewsItem[]
  mediaContext: SourcePacketMediaItem[]
  coverageContext: SourcePacketCoverageContext
  sourceWarnings: string[]
}

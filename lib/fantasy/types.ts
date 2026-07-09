export type FantasySlotType = "driver_1" | "team" | "driver_2" | "engineer"

export type FantasyAssetType = "driver" | "team" | "engineer"

export type FantasyLockStatus = "open" | "closing_soon" | "locked" | "finished"

export interface FantasyBudgetSnapshot {
  total: number
  spent: number
  remaining: number
  withinCap: boolean
}

export interface FantasyLineupItem {
  slotType: FantasySlotType
  assetId: number
  assetType: FantasyAssetType
  name: string
  shortName?: string
  teamName?: string
  teamColor?: string
  linkedTeamId?: number
  price: number
  entityId?: number
  linkedDriverId?: number
}

export interface FantasyLineupState {
  driver1: FantasyLineupItem | null
  team: FantasyLineupItem | null
  driver2: FantasyLineupItem | null
  engineer: FantasyLineupItem | null
}

export interface FantasyEligibilityState {
  isValid: boolean
  issues: string[]
  hasDriver1: boolean
  hasTeam: boolean
  hasDriver2: boolean
  hasEngineer: boolean
  hasPredictions: boolean
  budgetValid: boolean
  lockOpen: boolean
}

export interface FantasyPredictionsInput {
  poleDriverId: number
  raceWinnerDriverId: number
  podiumP2DriverId: number
  podiumP3DriverId: number
  fastestLapDriverId: number
  fastestPitTeamId: number
  safetyCarBand: string
  hasRedFlag: boolean
}

export interface FantasyAssetListItem {
  assetId: number
  assetType: FantasyAssetType
  name: string
  shortName?: string
  number?: number
  imageUrl?: string | null
  teamName?: string
  teamColor?: string
  linkedTeamId?: number
  linkedDriverId?: number
  linkedDriverSlot?: "driver_1" | "driver_2"
  price: number
  priceDelta?: number
  currentPosition?: number
  currentPoints?: number
  trendLabel?: string
  profileTag?: string
  qualifyingFormLabel?: string
  raceExecutionLabel?: string
  pitExecutionLabel?: string
  isSelected: boolean
  isDisabled: boolean
  disabledReason?: string
}

export interface FantasyAssetListResponse {
  items: FantasyAssetListItem[]
  selectedAssetIds: number[]
  budget: FantasyBudgetSnapshot | null
}

export interface FantasyPitWallLeadsResponse {
  items: FantasyAssetListItem[]
  selectedAssetIds: number[]
  budget: FantasyBudgetSnapshot | null
}

export interface FantasyBootstrapResponse {
  season: number
  round: number
  weekend: {
    id: number
    grandPrixName: string
    circuit: string
    country: string
    location: string
  }
  profile: {
    id: number
    displayName: string
    userId?: string | null
  } | null
  lockStatus: FantasyLockStatus
  lockAt: string | null
  budgetCap: number
  rosterSlots: FantasySlotType[]
  hasExistingDraft: boolean
  draftStatus: string | null
  scoreWeightsSummary: {
    drivers: number
    team: number
    engineer: number
    predictions: number
  }
}

export interface FantasyDraftResponse {
  profile: {
    id: number
    displayName: string
    userId?: string
  }
  entry: {
    id: number
    status: string
    budgetTotal: number
    budgetSpent: number
    lockedAt: string | null
  }
  draftStatus: string
  weekend: {
    id: number
    name: string
  }
}

export interface FantasyReviewResponse {
  lineup: FantasyLineupState
  budget: FantasyBudgetSnapshot
  eligibility: FantasyEligibilityState
  entryStatus: string
  predictions: {
    exists: boolean
    isComplete: boolean
  }
  lockStatus: FantasyLockStatus
  lockAt: string | null
  transfers?: {
    freeDriverTransfersLeft: number
    freeEngineerTransfersLeft: number
    teamLockedUntilRound: number | null
  }
}

export interface FantasyPredictionOptionsResponse {
  drivers: Array<{ id: number; name: string; shortName: string; teamName: string; teamColor: string }>
  teams: Array<{ id: number; name: string; color: string }>
  existingPredictions: FantasyPredictionsInput | null
  lockStatus: FantasyLockStatus
  lockAt: string | null
}

export interface FantasyLineupMutationResponse {
  lineup: FantasyLineupState
  budget: FantasyBudgetSnapshot
  eligibility: FantasyEligibilityState
  invalidations: string[]
}

export interface FantasyPredictionsMutationResponse {
  predictions: FantasyPredictionsInput
  eligibility: FantasyEligibilityState
  lockStatus: FantasyLockStatus
  lockAt: string | null
}

export interface FantasyLockResponse {
  success: boolean
  entryId: number
  lockedAt: string
  lineup: FantasyLineupState
  predictions: {
    exists: boolean
    isComplete: boolean
  }
  budget: FantasyBudgetSnapshot
}

export interface FantasyResultBlockItem {
  id: number
  scoreType: string
  label: string
  points: number
  assetId: number | null
  sourceTable: string
  sourceRecordId: number | null
  meta: Record<string, unknown> | null
}

export interface FantasyResultResponse {
  summary: {
    totalScore: number
    isOfficial: boolean
    lockedAt: string | null
    avgRoundScore?: number
  }
  lineup: FantasyLineupState
  blocks: {
    drivers: { subtotal: number; items: FantasyResultBlockItem[] }
    team: { subtotal: number; items: FantasyResultBlockItem[] }
    engineer: { subtotal: number; items: FantasyResultBlockItem[] }
    predictions: { subtotal: number; items: FantasyResultBlockItem[] }
  }
}

export interface FantasyScoreResponse {
  season: number
  round: number
  weekendId: number
  entriesScored: number
  results: Array<{
    entryId: number
    totalScore: number
    itemsCount: number
  }>
}

export interface FantasyLeaderboardEntry {
  rank: number
  profileId: number
  displayName: string
  totalScore: number
  roundsCount: number
  averageScore: number
  lastCalculatedAt: string | null
  isCurrentProfile: boolean
}

export interface FantasyRoundLeaderboardResponse {
  season: number
  round: number
  weekendId: number
  weekendName: string
  isOfficial: boolean
  entries: FantasyLeaderboardEntry[]
  currentProfileEntry: FantasyLeaderboardEntry | null
}

export interface FantasySeasonLeaderboardResponse {
  season: number
  entries: FantasyLeaderboardEntry[]
  currentProfileEntry: FantasyLeaderboardEntry | null
}

export interface FantasyLeaderboardResponse {
  round: FantasyRoundLeaderboardResponse | null
  season: {
    live: FantasySeasonLeaderboardResponse
    official: FantasySeasonLeaderboardResponse
  }
}

export interface FantasyApiError {
  error: string
}

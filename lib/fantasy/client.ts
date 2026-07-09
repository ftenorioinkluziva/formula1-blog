import type {
  FantasyApiError,
  FantasyAssetListResponse,
  FantasyBootstrapResponse,
  FantasyDraftResponse,
  FantasyLineupMutationResponse,
  FantasyLeaderboardResponse,
  FantasyLockResponse,
  FantasyPredictionOptionsResponse,
  FantasyPitWallLeadsResponse,
  FantasyPredictionsInput,
  FantasyPredictionsMutationResponse,
  FantasyResultResponse,
  FantasyReviewResponse,
  FantasyScoreResponse,
  FantasySlotType,
} from "@/lib/fantasy/types"

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as T | FantasyApiError

  if (!response.ok) {
    throw new Error((payload as FantasyApiError).error ?? "request_failed")
  }

  return payload as T
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value))
    }
  }

  return searchParams.toString()
}

export async function getFantasyBootstrap(locale: string, season: number, round: number): Promise<FantasyBootstrapResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/bootstrap?${query}`, { cache: "no-store" })
  return readJson<FantasyBootstrapResponse>(response)
}

export async function createFantasyDraft(locale: string, season: number, round: number, displayName?: string): Promise<FantasyDraftResponse> {
  const response = await fetch(`/${locale}/api/fantasy/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round, displayName }),
  })

  return readJson<FantasyDraftResponse>(response)
}

export async function getFantasyAssets(locale: string, season: number, round: number, type: "driver" | "team"): Promise<FantasyAssetListResponse> {
  const query = buildQuery({ season, round, type })
  const response = await fetch(`/${locale}/api/fantasy/assets?${query}`, { cache: "no-store" })
  return readJson<FantasyAssetListResponse>(response)
}

export async function getFantasyPitWallLeads(locale: string, season: number, round: number): Promise<FantasyPitWallLeadsResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/engineers?${query}`, { cache: "no-store" })
  return readJson<FantasyPitWallLeadsResponse>(response)
}

export async function updateFantasyLineup(
  locale: string,
  season: number,
  round: number,
  slotType: FantasySlotType,
  assetId: number,
): Promise<FantasyLineupMutationResponse> {
  const response = await fetch(`/${locale}/api/fantasy/draft/lineup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round, slotType, assetId }),
  })

  return readJson<FantasyLineupMutationResponse>(response)
}

export async function removeFantasyLineupSlot(
  locale: string,
  season: number,
  round: number,
  slotType: FantasySlotType,
): Promise<FantasyLineupMutationResponse> {
  const response = await fetch(`/${locale}/api/fantasy/draft/lineup`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round, slotType }),
  })

  return readJson<FantasyLineupMutationResponse>(response)
}

export async function getFantasyPredictionOptions(locale: string, season: number, round: number): Promise<FantasyPredictionOptionsResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/draft/predictions?${query}`, { cache: "no-store" })
  return readJson<FantasyPredictionOptionsResponse>(response)
}

export async function saveFantasyPredictions(
  locale: string,
  season: number,
  round: number,
  predictions: FantasyPredictionsInput,
): Promise<FantasyPredictionsMutationResponse> {
  const response = await fetch(`/${locale}/api/fantasy/draft/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round, predictions }),
  })

  return readJson<FantasyPredictionsMutationResponse>(response)
}

export async function getFantasyReview(locale: string, season: number, round: number): Promise<FantasyReviewResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/review?${query}`, { cache: "no-store" })
  return readJson<FantasyReviewResponse>(response)
}

export async function lockFantasyDraft(locale: string, season: number, round: number): Promise<FantasyLockResponse> {
  const response = await fetch(`/${locale}/api/fantasy/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round }),
  })

  return readJson<FantasyLockResponse>(response)
}

export async function getFantasyResult(locale: string, season: number, round: number): Promise<FantasyResultResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/result?${query}`, { cache: "no-store" })
  return readJson<FantasyResultResponse>(response)
}

export async function triggerFantasyScore(locale: string, season: number, round: number): Promise<FantasyScoreResponse> {
  const response = await fetch(`/${locale}/api/fantasy/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, round }),
  })

  return readJson<FantasyScoreResponse>(response)
}

export async function getFantasyLeaderboard(locale: string, season: number, round: number): Promise<FantasyLeaderboardResponse> {
  const query = buildQuery({ season, round })
  const response = await fetch(`/${locale}/api/fantasy/leaderboard?${query}`, { cache: "no-store" })
  return readJson<FantasyLeaderboardResponse>(response)
}

export async function updateFantasyProfile(
  locale: string,
  displayName: string,
): Promise<{ success: boolean; profile: { id: number; displayName: string; userId: string } }> {
  const response = await fetch(`/${locale}/api/fantasy/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  })

  return readJson<{ success: boolean; profile: { id: number; displayName: string; userId: string } }>(response)
}
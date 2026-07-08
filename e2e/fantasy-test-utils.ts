import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test"

export const LOCALE = "en"
export const SEASON = 2026
export const SESSION_STORAGE_KEY = "fantasy-session-key"

export interface BootstrapResponse {
  lockStatus: "open" | "closing_soon" | "locked" | "finished"
}

export interface ResultResponse {
  summary: {
    totalScore: number
    isOfficial: boolean
  }
  blocks: {
    engineer: {
      subtotal: number
      items: Array<{ id: number; label: string; points: number }>
    }
  }
}

export interface AssetOption {
  assetId: number
  price: number
  isDisabled: boolean
  linkedTeamId?: number
  teamName?: string
}

export interface AssetListResponse {
  items: AssetOption[]
}

export interface PitWallLeadsResponse {
  items: AssetOption[]
}

export interface PredictionOptionsResponse {
  drivers: Array<{ id: number; name: string }>
  teams: Array<{ id: number; name: string }>
}

export interface ReviewResponse {
  lineup: {
    engineer: { assetId: number } | null
  }
}

export async function fetchJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url)

  if (!response.ok()) {
    throw new Error(`Request failed: ${url} (${response.status()})`)
  }

  return (await response.json()) as T
}

export async function createDraft(request: APIRequestContext, round: number, sessionKey: string): Promise<void> {
  const response = await request.post(`/${LOCALE}/api/fantasy/draft`, {
    data: {
      season: SEASON,
      round,
      sessionKey,
      displayName: `Fantasy E2E ${round}`,
    },
  })

  if (!response.ok()) {
    throw new Error(`Unable to create draft for round ${round} (${response.status()})`)
  }
}

export async function findOpenRound(request: APIRequestContext, sessionKey: string): Promise<number | null> {
  for (let round = 1; round <= 24; round += 1) {
    const response = await request.get(`/${LOCALE}/api/fantasy/bootstrap?season=${SEASON}&round=${round}&sessionKey=${sessionKey}`)

    if (!response.ok()) {
      continue
    }

    const payload = (await response.json()) as BootstrapResponse

    if (payload.lockStatus === "open" || payload.lockStatus === "closing_soon") {
      return round
    }
  }

  return null
}

export async function clickAndWaitForMutation(page: Page, trigger: Locator, path: string, readyStateLocator?: Locator): Promise<void> {
  await expect(trigger).toBeEnabled()

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(path) &&
      response.request().method() === "POST",
  )

  await trigger.click()

  const response = await responsePromise
  expect(response.ok(), `Expected successful mutation for ${path}`).toBeTruthy()

  if (readyStateLocator) {
    await expect(readyStateLocator).toBeEnabled()
  }
}

export function chooseCheapestAssets(items: AssetOption[], count: number): AssetOption[] {
  return [...items]
    .filter((item) => !item.isDisabled)
    .sort((left, right) => left.price - right.price)
    .slice(0, count)
}

export async function seedSessionKey(page: Page, sessionKey: string): Promise<void> {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      window.localStorage.setItem(storageKey, storageValue)
    },
    [SESSION_STORAGE_KEY, sessionKey],
  )
}

export async function fillPredictions(page: Page, predictionOptions: PredictionOptionsResponse): Promise<void> {
  const driver = predictionOptions.drivers[0]
  const team = predictionOptions.teams[0]

  if (!driver || !team) return

  const fields = [
    { id: "fantasy-prediction-pole", name: driver.name },
    { id: "fantasy-prediction-race-winner", name: driver.name },
    { id: "fantasy-prediction-podium-p2", name: driver.name },
    { id: "fantasy-prediction-podium-p3", name: driver.name },
    { id: "fantasy-prediction-fastest-lap", name: driver.name },
    { id: "fantasy-prediction-fastest-pit-team", name: team.name },
    { id: "fantasy-prediction-safety-car-band", name: "1-2" },
    { id: "fantasy-prediction-red-flag", name: "No" },
  ]

  for (const field of fields) {
    const trigger = page.getByTestId(field.id)
    await trigger.click()
    await page.locator('[role="option"]').filter({ hasText: field.name }).first().click()
  }
}

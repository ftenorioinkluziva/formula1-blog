import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test"
import { closeDb, getDb } from "../lib/db/client"
import { fantasyProfiles } from "../lib/db/schema"
import { eq } from "drizzle-orm"

export const LOCALE = "en"
export const SEASON = 2026

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

export async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
): Promise<{ cookieHeader: string; userId: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.com`
  const password = "Password123!"
  const name = "E2E Test User"

  const port = process.env.PORT || "3000"
  const origin = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`

  // Sign up via API request
  const response = await request.post("/api/auth/sign-up/email", {
    headers: {
      Origin: origin,
    },
    data: {
      email,
      password,
      name,
    },
  })

  if (!response.ok()) {
    throw new Error(`Sign up failed: ${await response.text()}`)
  }

  const payload = await response.json()
  const userId = payload.user.id

  const setCookie = response.headers()["set-cookie"]
  if (!setCookie) {
    throw new Error("No set-cookie header returned on sign up")
  }

  // Parse better-auth.session_token
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/)
  if (!match) {
    throw new Error("better-auth.session_token not found in set-cookie header")
  }
  const sessionToken = match[1]

  // Add cookie to browser page context using the origin URL
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: sessionToken,
      url: origin,
    },
  ])

  return {
    cookieHeader: `better-auth.session_token=${sessionToken}`,
    userId,
  }
}

export async function linkUserToProfile(userId: string, sessionKey: string): Promise<void> {
  const db = getDb()
  if (!db) {
    throw new Error("Database client not available in linkUserToProfile")
  }
  // Link the pre-seeded profile (identified by session_key) to our new user
  await db
    .update(fantasyProfiles)
    .set({ userId })
    .where(eq(fantasyProfiles.sessionKey, sessionKey))
}

export async function closeTestDatabase(): Promise<void> {
  await closeDb()
}

export async function fetchJson<T>(request: APIRequestContext, url: string, cookieHeader?: string): Promise<T> {
  const response = await request.get(url, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  })

  if (!response.ok()) {
    throw new Error(`Request failed: ${url} (${response.status()})`)
  }

  return (await response.json()) as T
}

export async function createDraft(request: APIRequestContext, round: number, cookieHeader: string): Promise<void> {
  const response = await request.post(`/${LOCALE}/api/fantasy/draft`, {
    headers: { Cookie: cookieHeader },
    data: {
      season: SEASON,
      round,
      displayName: `Fantasy E2E ${round}`,
    },
  })

  if (!response.ok()) {
    throw new Error(`Unable to create draft for round ${round} (${response.status()})`)
  }
}

export async function findOpenRound(request: APIRequestContext, cookieHeader?: string): Promise<number | null> {
  for (let round = 1; round <= 24; round += 1) {
    const response = await request.get(`/${LOCALE}/api/fantasy/bootstrap?season=${SEASON}&round=${round}`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    })

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

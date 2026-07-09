import { expect, test } from "@playwright/test"
import {
  LOCALE,
  SEASON,
  type AssetListResponse,
  type PitWallLeadsResponse,
  type PredictionOptionsResponse,
  chooseCheapestAssets,
  clickAndWaitForMutation,
  closeTestDatabase,
  createDraft,
  fetchJson,
  fillPredictions,
  findOpenRound,
  registerAndLogin,
} from "./fantasy-test-utils"

test.afterAll(async () => {
  await closeTestDatabase()
})

test("completa o fluxo feliz da fantasy para uma rodada aberta", async ({ page, request }) => {
  // #given
  const { cookieHeader } = await registerAndLogin(page, request)
  const round = await findOpenRound(request, cookieHeader)

  test.skip(round === null, "Nenhuma rodada fantasy aberta foi encontrada para o teste E2E.")

  await createDraft(request, round, cookieHeader)

  // #when
  await page.goto(`/${LOCALE}/fantasy?round=${round}`)

  // #then
  await expect(page.getByTestId("fantasy-dashboard")).toBeVisible()
  await expect(page.getByTestId("fantasy-round-select")).toHaveValue(String(round))
  await expect(page.getByTestId("fantasy-drivers-card")).toBeVisible()
  await expect(page.getByTestId("fantasy-teams-card")).toBeVisible()

  const savePredictionsButton = page.getByTestId("fantasy-save-predictions-button")
  const lockButton = page.getByTestId("fantasy-lock-button")

  const [driversPayload, teamsPayload, predictionsPayload] = await Promise.all([
    fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=driver`, cookieHeader),
    fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=team`, cookieHeader),
    fetchJson<PredictionOptionsResponse>(request, `/${LOCALE}/api/fantasy/draft/predictions?season=${SEASON}&round=${round}`, cookieHeader),
  ])

  const [driverOne, driverTwo] = chooseCheapestAssets(driversPayload.items, 2)
  const [team] = chooseCheapestAssets(teamsPayload.items, 1)

  await expect(page.getByTestId(`fantasy-select-driver-1-${driverOne.assetId}`)).toBeVisible()
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-1-${driverOne.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)

  await expect(page.getByTestId(`fantasy-select-driver-2-${driverTwo.assetId}`)).toBeVisible()
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-2-${driverTwo.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)

  await expect(page.getByTestId(`fantasy-select-team-${team.assetId}`)).toBeVisible()
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-team-${team.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)

  const engineersPayload = await fetchJson<PitWallLeadsResponse>(request, `/${LOCALE}/api/fantasy/engineers?season=${SEASON}&round=${round}`, cookieHeader)
  const [engineer] = chooseCheapestAssets(engineersPayload.items, 1)

  await expect(page.getByTestId(`fantasy-select-engineer-${engineer.assetId}`)).toBeVisible()
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-engineer-${engineer.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)

  await fillPredictions(page, predictionsPayload)

  await clickAndWaitForMutation(page, savePredictionsButton, "/api/fantasy/draft/predictions", lockButton)

  await clickAndWaitForMutation(page, lockButton, "/api/fantasy/lock")

  await expect(lockButton).toBeDisabled()
  await expect(savePredictionsButton).toBeDisabled()
  await expect(page.getByTestId("fantasy-result-card")).toBeVisible()

  await page.getByTestId("fantasy-leaderboard-mode-round").click()
  await expect(page.getByTestId("fantasy-leaderboard-mode-round")).toHaveAttribute("data-state", "on")

  await page.getByTestId("fantasy-leaderboard-view-around").click()
  await expect(page.getByTestId("fantasy-leaderboard-view-around")).toHaveAttribute("data-state", "on")
})

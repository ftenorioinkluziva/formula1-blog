import { expect, test } from "@playwright/test"
import {
  LOCALE,
  SEASON,
  type AssetListResponse,
  type PitWallLeadsResponse,
  type PredictionOptionsResponse,
  type ResultResponse,
  type ReviewResponse,
  chooseCheapestAssets,
  clickAndWaitForMutation,
  closeTestDatabase,
  createDraft,
  fetchJson,
  fillPredictions,
  findOpenRound,
  registerAndLogin,
  linkUserToProfile,
} from "./fantasy-test-utils"

test.afterAll(async () => {
  await closeTestDatabase()
})

test("permite escolher um Pit Wall Lead de equipe diferente da dupla de pilotos", async ({ page, request }) => {
  // #given
  const { cookieHeader } = await registerAndLogin(page, request)
  const round = await findOpenRound(request, cookieHeader)

  test.skip(round === null, "Nenhuma rodada fantasy aberta foi encontrada para o teste E2E.")

  await createDraft(request, round, cookieHeader)

  const driversPayload = await fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=driver`, cookieHeader)
  const teamsPayload = await fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=team`, cookieHeader)
  const pitWallPayload = await fetchJson<PitWallLeadsResponse>(request, `/${LOCALE}/api/fantasy/engineers?season=${SEASON}&round=${round}`, cookieHeader)

  const [driverOne, driverTwo] = chooseCheapestAssets(driversPayload.items, 2)
  const [team] = chooseCheapestAssets(teamsPayload.items, 1)
  const pitWallFromDifferentTeam = pitWallPayload.items.find(
    (item) => item.linkedTeamId !== driverOne.linkedTeamId && item.linkedTeamId !== driverTwo.linkedTeamId,
  )

  test.skip(!pitWallFromDifferentTeam, "Nao foi encontrado Pit Wall Lead de equipe diferente para validar a regra global.")

  // #when
  await page.goto(`/${LOCALE}/fantasy?round=${round}`)

  const savePredictionsButton = page.getByTestId("fantasy-save-predictions-button")
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-1-${driverOne.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-2-${driverTwo.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-team-${team.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-engineer-${pitWallFromDifferentTeam.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)

  const review = await fetchJson<ReviewResponse>(request, `/${LOCALE}/api/fantasy/review?season=${SEASON}&round=${round}`, cookieHeader)

  // #then
  expect(review.lineup.engineer?.assetId).toBe(pitWallFromDifferentTeam.assetId)
  await expect(page.getByTestId("fantasy-error-banner")).toHaveCount(0)
})

test("bloqueia mutacoes de lineup e predictions depois do lock", async ({ page, request }) => {
  // #given
  const { cookieHeader } = await registerAndLogin(page, request)
  const round = await findOpenRound(request, cookieHeader)

  test.skip(round === null, "Nenhuma rodada fantasy aberta foi encontrada para o teste E2E.")

  await createDraft(request, round, cookieHeader)

  const [driversPayload, teamsPayload, pitWallPayload, predictionsPayload] = await Promise.all([
    fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=driver`, cookieHeader),
    fetchJson<AssetListResponse>(request, `/${LOCALE}/api/fantasy/assets?season=${SEASON}&round=${round}&type=team`, cookieHeader),
    fetchJson<PitWallLeadsResponse>(request, `/${LOCALE}/api/fantasy/engineers?season=${SEASON}&round=${round}`, cookieHeader),
    fetchJson<PredictionOptionsResponse>(request, `/${LOCALE}/api/fantasy/draft/predictions?season=${SEASON}&round=${round}`, cookieHeader),
  ])

  const [driverOne, driverTwo] = chooseCheapestAssets(driversPayload.items, 2)
  const [team] = chooseCheapestAssets(teamsPayload.items, 1)
  const [pitWall] = chooseCheapestAssets(pitWallPayload.items, 1)

  // #when
  await page.goto(`/${LOCALE}/fantasy?round=${round}`)

  const savePredictionsButton = page.getByTestId("fantasy-save-predictions-button")
  const lockButton = page.getByTestId("fantasy-lock-button")

  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-1-${driverOne.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-driver-2-${driverTwo.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-team-${team.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await clickAndWaitForMutation(page, page.getByTestId(`fantasy-select-engineer-${pitWall.assetId}`), "/api/fantasy/draft/lineup", savePredictionsButton)
  await fillPredictions(page, predictionsPayload)
  await clickAndWaitForMutation(page, savePredictionsButton, "/api/fantasy/draft/predictions", lockButton)
  await clickAndWaitForMutation(page, lockButton, "/api/fantasy/lock")

  const lineupMutation = await request.post(`/${LOCALE}/api/fantasy/draft/lineup`, {
    headers: { Cookie: cookieHeader },
    data: {
      season: SEASON,
      round,
      slotType: "team",
      assetId: team.assetId,
    },
  })
  const predictionsMutation = await request.post(`/${LOCALE}/api/fantasy/draft/predictions`, {
    headers: { Cookie: cookieHeader },
    data: {
      season: SEASON,
      round,
      predictions: {
        poleDriverId: predictionsPayload.drivers[0]?.id ?? 0,
        raceWinnerDriverId: predictionsPayload.drivers[0]?.id ?? 0,
        podiumP2DriverId: predictionsPayload.drivers[0]?.id ?? 0,
        podiumP3DriverId: predictionsPayload.drivers[0]?.id ?? 0,
        fastestLapDriverId: predictionsPayload.drivers[0]?.id ?? 0,
        fastestPitTeamId: predictionsPayload.teams[0]?.id ?? 0,
        safetyCarBand: "1-2",
        hasRedFlag: false,
      },
    },
  })

  const lineupMutationBody = await lineupMutation.json()
  const predictionsMutationBody = await predictionsMutation.json()

  // #then
  expect(lineupMutation.status()).toBe(400)
  expect(lineupMutationBody.error).toBe("entry_locked")
  expect(predictionsMutation.status()).toBe(400)
  expect(predictionsMutationBody.error).toBe("entry_locked")
  await expect(lockButton).toBeDisabled()
  await expect(savePredictionsButton).toBeDisabled()
})

test("abre uma rodada finalizada com breakdown persistido e UI bloqueada", async ({ page, request }) => {
  // #given
  const round = 1
  const sessionKey = "fantasy-score-r1"

  const { cookieHeader, userId } = await registerAndLogin(page, request)
  await linkUserToProfile(userId, sessionKey)

  const bootstrap = await fetchJson<{ lockStatus: "open" | "closing_soon" | "locked" | "finished" }>(
    request,
    `/${LOCALE}/api/fantasy/bootstrap?season=${SEASON}&round=${round}`,
    cookieHeader,
  )
  const result = await fetchJson<ResultResponse>(
    request,
    `/${LOCALE}/api/fantasy/result?season=${SEASON}&round=${round}`,
    cookieHeader,
  )

  test.skip(bootstrap.lockStatus !== "finished", "A rodada 1 nao esta finalizada neste ambiente.")
  test.skip(!result.summary.isOfficial, "A rodada 1 ainda nao possui score oficial persistido neste ambiente.")

  // #when
  await page.goto(`/${LOCALE}/fantasy?round=${round}`)

  // #then
  await expect(page.getByTestId("fantasy-round-select")).toHaveValue(String(round))
  await expect(page.getByTestId("fantasy-lock-button")).toBeDisabled()
  await expect(page.getByTestId("fantasy-save-predictions-button")).toBeDisabled()
  await expect(page.getByTestId("fantasy-result-card")).toBeVisible()
  await expect(page.getByTestId("fantasy-result-empty")).toHaveCount(0)
  await expect(page.getByTestId("fantasy-result-block-pit wall")).toBeVisible()
  await expect(page.getByTestId("fantasy-result-subtotal-pit wall")).toContainText(String(result.blocks.engineer.subtotal))
})

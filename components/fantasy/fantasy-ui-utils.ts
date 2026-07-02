import type { FantasyReviewResponse, FantasySlotType } from "@/lib/fantasy/types"

export function formatFantasyCurrency(value: number): string {
  return value.toFixed(1)
}

export function fantasySlotLabel(slot: FantasySlotType): string {
  switch (slot) {
    case "driver_1":
      return "Driver 1"
    case "driver_2":
      return "Driver 2"
    case "team":
      return "Team"
    case "engineer":
      return "Pit Wall Lead"
  }
}

export function fantasyIssueLabel(issue: string): string {
  switch (issue) {
    case "missing_driver_1":
      return "Escolha o primeiro piloto"
    case "missing_driver_2":
      return "Escolha o segundo piloto"
    case "missing_team":
      return "Escolha a equipe"
    case "missing_engineer":
      return "Escolha o Pit Wall Lead"
    case "missing_predictions":
      return "Preencha as previsoes"
    case "budget_exceeded":
      return "O budget estourou"
    case "lock_closed":
      return "O lock da rodada ja fechou"
    case "entry_locked":
      return "A entry ja esta locked"
    default:
      return issue.replaceAll("_", " ")
  }
}

export function selectedFantasyAssetIdForSlot(
  review: FantasyReviewResponse | null,
  slot: FantasySlotType,
): number | null {
  if (!review) return null
  if (slot === "driver_1") return review.lineup.driver1?.assetId ?? null
  if (slot === "driver_2") return review.lineup.driver2?.assetId ?? null
  if (slot === "team") return review.lineup.team?.assetId ?? null
  return review.lineup.engineer?.assetId ?? null
}
const NATIONALITY_FLAG_BY_NAME: Record<string, string> = {
  British: "\uD83C\uDDEC\uD83C\uDDE7",
  Dutch: "\uD83C\uDDF3\uD83C\uDDF1",
  Australian: "\uD83C\uDDE6\uD83C\uDDFA",
  "Monegasque": "\uD83C\uDDF2\uD83C\uDDE8",
  "Mon\u00E9gasque": "\uD83C\uDDF2\uD83C\uDDE8",
  Italian: "\uD83C\uDDEE\uD83C\uDDF9",
  Thai: "\uD83C\uDDF9\uD83C\uDDED",
  Spanish: "\uD83C\uDDEA\uD83C\uDDF8",
  German: "\uD83C\uDDE9\uD83C\uDDEA",
  French: "\uD83C\uDDEB\uD83C\uDDF7",
  "New Zealander": "\uD83C\uDDF3\uD83C\uDDFF",
  Canadian: "\uD83C\uDDE8\uD83C\uDDE6",
  Brazilian: "\uD83C\uDDE7\uD83C\uDDF7",
  Argentine: "\uD83C\uDDE6\uD83C\uDDF7",
  Mexican: "\uD83C\uDDF2\uD83C\uDDFD",
  Finnish: "\uD83C\uDDEB\uD83C\uDDEE",
}

const NATIONALITY_TO_ISO2: Record<string, string> = {
  Argentine: "AR",
  Australian: "AU",
  Brazilian: "BR",
  British: "GB",
  Canadian: "CA",
  Dutch: "NL",
  Finnish: "FI",
  French: "FR",
  German: "DE",
  Italian: "IT",
  Mexican: "MX",
  Monegasque: "MC",
  "Mon\u00E9gasque": "MC",
  "New Zealander": "NZ",
  Spanish: "ES",
  Thai: "TH",
}

const ISO3_TO_ISO2: Record<string, string> = {
  ARG: "AR",
  AUS: "AU",
  BRA: "BR",
  CAN: "CA",
  DEU: "DE",
  ESP: "ES",
  FIN: "FI",
  FRA: "FR",
  GBR: "GB",
  ITA: "IT",
  MCO: "MC",
  MEX: "MX",
  NLD: "NL",
  NZL: "NZ",
  THA: "TH",
}

function toFlagEmojiFromIso2(countryCode: string): string {
  const upperCode = countryCode.toUpperCase()

  if (!/^[A-Z]{2}$/.test(upperCode)) {
    return ""
  }

  return String.fromCodePoint(
    ...upperCode.split("").map((char) => 127397 + char.charCodeAt(0)),
  )
}

function resolveProvidedFlag(providedFlag?: string | null): string {
  const trimmed = providedFlag?.trim()

  if (!trimmed) {
    return ""
  }

  const upperFlag = trimmed.toUpperCase()
  const normalizedIso2 = upperFlag === "UK" ? "GB" : upperFlag

  if (/^[A-Z]{2}$/.test(normalizedIso2)) {
    return toFlagEmojiFromIso2(normalizedIso2)
  }

  if (/^[A-Z]{3}$/.test(upperFlag)) {
    const iso2Code = ISO3_TO_ISO2[upperFlag]

    if (iso2Code) {
      return toFlagEmojiFromIso2(iso2Code)
    }
  }

  return trimmed
}

export function getNationalityCountryCode(nationality: string, providedFlag?: string | null): string {
  const trimmed = providedFlag?.trim()

  if (trimmed) {
    const upperFlag = trimmed.toUpperCase()
    const normalizedIso2 = upperFlag === "UK" ? "GB" : upperFlag

    if (/^[A-Z]{2}$/.test(normalizedIso2)) {
      return normalizedIso2
    }

    if (/^[A-Z]{3}$/.test(upperFlag)) {
      const iso2Code = ISO3_TO_ISO2[upperFlag]

      if (iso2Code) {
        return iso2Code
      }
    }
  }

  return NATIONALITY_TO_ISO2[nationality] ?? ""
}

export function getNationalityFlagImageUrl(nationality: string, providedFlag?: string | null): string {
  const countryCode = getNationalityCountryCode(nationality, providedFlag)

  if (!countryCode) {
    return ""
  }

  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`
}

export function getNationalityFlag(nationality: string, providedFlag?: string | null): string {
  const normalizedProvidedFlag = resolveProvidedFlag(providedFlag)

  if (normalizedProvidedFlag) {
    return normalizedProvidedFlag
  }

  return NATIONALITY_FLAG_BY_NAME[nationality] ?? ""
}

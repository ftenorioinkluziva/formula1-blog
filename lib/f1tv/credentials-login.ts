import "server-only"

import { getClientState, refreshConfig } from "@/lib/f1tv/client"

const F1_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export interface F1TVLoginResult {
  rawCookieValue: string
  decoded: Record<string, unknown>
  expiresAt: Date
}

interface F1AuthResponse {
  data?: {
    subscriptionToken?: string
  }
  rawCookieValue?: string
  token?: string
  subscriptionToken?: string
  errorDescription?: string
  resultCode?: string
}

async function getApiKey(): Promise<{ apiKey: string; authUrl: string }> {
  let config = getClientState().config
  if (!config) {
    config = await refreshConfig()
  }
  const { apiKey } = config.authentication
  const authUrl = "https://api.formula1.com/v2/account/subscriber/authenticate/by-password"
  return { apiKey, authUrl }
}

export function decodeTokenPayload(raw: string): Record<string, unknown> | null {
  let jwt = raw
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    if (parsed?.data?.subscriptionToken) {
      jwt = parsed.data.subscriptionToken
    }
  } catch {
    // raw is already a JWT
  }

  const parts = jwt.split(".")
  if (parts.length !== 3) return null
  let payload = parts[1]
  const pad = payload.length % 4
  if (pad > 0) payload += "=".repeat(4 - pad)
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"))
  } catch {
    return null
  }
}

function isCookieToken(raw: string): boolean {
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    return typeof parsed?.data?.subscriptionToken === "string"
  } catch {
    return false
  }
}

export async function loginWithF1TVCredentials(
  email: string,
  password: string,
): Promise<F1TVLoginResult> {
  const { apiKey, authUrl } = await getApiKey()
  const proxyResult = await loginWithF1TVCredentialsViaProxy(email, password, apiKey)
  if (proxyResult) return proxyResult

  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey,
      "User-Agent": F1_USER_AGENT,
    },
    body: JSON.stringify({ Login: email, Password: password }),
  })

  const rawText = await res.text()
  let authData: F1AuthResponse
  try {
    authData = JSON.parse(rawText) as F1AuthResponse
  } catch {
    console.error("[f1tv/auth] Non-JSON response from F1 API:", rawText.slice(0, 300))
    throw new Error(`F1 API returned non-JSON (${res.status}): ${rawText.slice(0, 120)}`)
  }

  if (!res.ok || authData.resultCode === "ERR" || authData.errorDescription) {
    throw new Error(authData.errorDescription ?? `Auth failed (${res.status})`)
  }

  const subscriptionToken = authData.data?.subscriptionToken
  if (!subscriptionToken) {
    throw new Error("No subscription token in response")
  }

  const decoded = decodeTokenPayload(subscriptionToken)
  if (!decoded || typeof decoded.exp !== "number") {
    throw new Error("Failed to decode token")
  }

  const expiresAt = new Date(decoded.exp * 1000)
  if (expiresAt < new Date()) {
    throw new Error("Received token is already expired")
  }

  const rawCookieValue = encodeURIComponent(
    JSON.stringify({ data: { subscriptionToken } }),
  )

  return {
    rawCookieValue,
    decoded,
    expiresAt,
  }
}

async function loginWithF1TVCredentialsViaProxy(
  email: string,
  password: string,
  apiKey: string,
): Promise<F1TVLoginResult | null> {
  const proxyUrl = getF1TVProxyAuthUrl()
  if (!proxyUrl) return null

  const proxySecret = process.env.F1TV_PROXY_SECRET
  if (!proxySecret) {
    throw new Error("F1TV_PROXY_SECRET is required when F1TV_PROXY_URL is set")
  }

  const res = await fetch(proxyUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-f1tv-proxy-secret": proxySecret,
    },
    body: JSON.stringify({
      action: "authenticate",
      email,
      password,
      apiKey,
    }),
  })

  const rawText = await res.text()
  let payload: F1AuthResponse
  try {
    payload = JSON.parse(rawText) as F1AuthResponse
  } catch {
    throw new Error(
      `F1TV auth proxy returned non-JSON (${res.status}) from ${proxyUrl}. ` +
      `Check the local proxy route and normalize upstream F1 errors to JSON. Preview: ${rawText.slice(0, 120)}`,
    )
  }

  if (!res.ok || payload.resultCode === "ERR" || payload.errorDescription) {
    throw new Error(payload.errorDescription ?? `F1TV proxy auth failed (${res.status})`)
  }

  const rawToken =
    payload.rawCookieValue ??
    payload.token ??
    payload.subscriptionToken ??
    payload.data?.subscriptionToken

  if (!rawToken) {
    throw new Error("F1TV proxy auth response did not include a token")
  }

  const decoded = decodeTokenPayload(rawToken)
  if (!decoded || typeof decoded.exp !== "number") {
    throw new Error("Failed to decode proxy token")
  }

  const expiresAt = new Date(decoded.exp * 1000)
  if (expiresAt < new Date()) {
    throw new Error("Proxy returned token is already expired")
  }

  const rawCookieValue = isCookieToken(rawToken)
    ? rawToken
    : encodeURIComponent(JSON.stringify({ data: { subscriptionToken: rawToken } }))

  return {
    rawCookieValue,
    decoded,
    expiresAt,
  }
}

function getF1TVProxyAuthUrl(): string | null {
  const explicitAuthUrl = process.env.F1TV_PROXY_AUTH_URL
  if (explicitAuthUrl) return explicitAuthUrl

  const proxyUrl = process.env.F1TV_PROXY_URL
  if (!proxyUrl) return null

  const url = new URL(proxyUrl)
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/f1tv/auth"
    return url.toString()
  }

  if (url.pathname.endsWith("/f1tv/play")) {
    url.pathname = url.pathname.replace(/\/f1tv\/play$/, "/f1tv/auth")
    return url.toString()
  }

  if (!url.pathname.endsWith("/f1tv/auth")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/f1tv/auth`
  }
  return url.toString()
}

export async function loginWithEnvCredentials(): Promise<F1TVLoginResult> {
  const email = process.env.F1TV_EMAIL
  const password = process.env.F1TV_PASSWORD

  if (!email || !password) {
    throw new Error("F1TV_EMAIL and F1TV_PASSWORD are not configured on the server")
  }

  return loginWithF1TVCredentials(email, password)
}

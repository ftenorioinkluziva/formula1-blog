import type { F1TVDecodedToken } from './types'

const JWKS_URL = 'https://api.formula1.com/static/jwks.json'

interface AuthState {
  subscriptionToken: string | null
  decodedToken: F1TVDecodedToken | null
  expiresAt: number
}

const state: AuthState = {
  subscriptionToken: null,
  decodedToken: null,
  expiresAt: 0,
}

function decodeTokenPayload(token: string): F1TVDecodedToken | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  let payload = parts[1]
  const missingPadding = payload.length % 4
  if (missingPadding > 0) {
    payload += '='.repeat(4 - missingPadding)
  }

  const decoded = Buffer.from(payload, 'base64').toString('utf-8')
  return JSON.parse(decoded) as F1TVDecodedToken
}

function extractSubscriptionTokenFromCookie(cookie: string): string | null {
  try {
    const decoded = decodeURIComponent(cookie)
    const parsed = JSON.parse(decoded)
    return parsed?.data?.subscriptionToken ?? null
  } catch {
    return null
  }
}

function validateToken(token: string): { subscriptionToken: string; decoded: F1TVDecodedToken } {
  const subToken = extractSubscriptionTokenFromCookie(token)
  const tokenToValidate = subToken ?? token

  const decoded = decodeTokenPayload(tokenToValidate)
  if (!decoded) {
    throw new Error('Failed to decode F1TV token — invalid JWT format')
  }

  if (decoded.exp * 1000 < Date.now()) {
    throw new Error(
      `F1TV token expired on ${new Date(decoded.exp * 1000).toISOString()} — login again at https://account.formula1.com`
    )
  }

  if (decoded.SubscriptionStatus && decoded.SubscriptionStatus !== 'active') {
    throw new Error(
      `F1TV subscription status is "${decoded.SubscriptionStatus}" — an active F1TV Pro subscription is required`
    )
  }

  return { subscriptionToken: tokenToValidate, decoded }
}

export async function ensureAuthenticated(): Promise<string> {
  if (state.subscriptionToken && Date.now() < state.expiresAt) {
    return state.subscriptionToken
  }

  const candidates: Array<string | null | undefined> = [process.env.F1TV_TOKEN]

  try {
    const { loadTokenFromRedis } = await import('@/lib/f1tv/token-store')
    candidates.push(await loadTokenFromRedis())
  } catch {
    // Redis fallback is optional.
  }

  for (const rawToken of candidates) {
    if (!rawToken) continue

    try {
      const { subscriptionToken, decoded } = validateToken(rawToken)

      state.subscriptionToken = subscriptionToken
      state.decodedToken = decoded
      state.expiresAt = decoded.exp * 1000

      console.log(
        `[f1tv/auth] Authenticated: ${decoded.FirstName} ${decoded.LastName} ` +
        `(expires ${new Date(state.expiresAt).toISOString()})`
      )

      return subscriptionToken
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    'No valid F1TV token available. To obtain it:\n' +
    '  1. Run: pnpm f1tv:login\n' +
    '  2. Login at the browser window that opens\n' +
    '  3. The token will be saved to .env.local automatically\n' +
    '  Or manually: login at https://account.formula1.com, copy the "login-session" cookie value, and set F1TV_TOKEN in .env.local or /admin/f1tv'
  )
}

export function setTokenDirectly(rawToken: string): void {
  const { subscriptionToken, decoded } = validateToken(rawToken)
  state.subscriptionToken = subscriptionToken
  state.decodedToken = decoded
  state.expiresAt = decoded.exp * 1000
}

export function getSubscriptionToken(): string | null {
  return state.subscriptionToken
}

export function getDecodedToken(): F1TVDecodedToken | null {
  return state.decodedToken
}

export function isAuthenticated(): boolean {
  if (state.subscriptionToken && Date.now() < state.expiresAt) {
    return true
  }

  const rawToken = process.env.F1TV_TOKEN
  if (!rawToken) return false

  try {
    const { subscriptionToken, decoded } = validateToken(rawToken)
    state.subscriptionToken = subscriptionToken
    state.decodedToken = decoded
    state.expiresAt = decoded.exp * 1000
    return true
  } catch {
    return false
  }
}

export function clearAuth(): void {
  state.subscriptionToken = null
  state.decodedToken = null
  state.expiresAt = 0
}

export { JWKS_URL }

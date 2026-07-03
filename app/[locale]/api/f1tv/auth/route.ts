import { NextRequest, NextResponse } from 'next/server'
import { ensureAuthenticated, getDecodedToken } from '@/lib/f1tv/auth'
import {
  decodeTokenPayload,
  loginWithEnvCredentials,
  loginWithF1TVCredentials,
} from '@/lib/f1tv/credentials-login'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function activateToken(rawCookieValue: string) {
  const { activateAndPersistToken } = await import('@/lib/f1tv/token-persistence')
  return activateAndPersistToken(rawCookieValue)
}

function authError(err: unknown, status = 500) {
  return NextResponse.json(
    {
      error: err instanceof Error ? err.message : String(err),
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Path A: raw cookie token pasted directly
  if (body.token) {
    const rawCookieValue = body.token.trim()
    const decoded = decodeTokenPayload(rawCookieValue)
    if (!decoded || typeof decoded.exp !== 'number') {
      return NextResponse.json({ error: 'Invalid token format — could not decode JWT' }, { status: 400 })
    }
    const expiresAt = new Date(decoded.exp * 1000)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: `Token already expired on ${expiresAt.toISOString()}` },
        { status: 400 }
      )
    }
    let persistedEnv = false
    let persistedRedis = false
    try {
      ;({ persistedEnv, persistedRedis } = await activateToken(rawCookieValue))
    } catch (err) {
      return authError(err)
    }
    return NextResponse.json({
      success: true,
      persisted: persistedEnv || persistedRedis,
      token: rawCookieValue,
      expiresAt: expiresAt.toISOString(),
      name: `${decoded.FirstName ?? ''} ${decoded.LastName ?? ''}`.trim(),
      subscription: decoded.SubscribedProduct ?? null,
    })
  }

  // Path B: email + password -> call F1 API server-side
  const useEnvCredentials = body.useEnvCredentials === '1'
  if (!useEnvCredentials && (!body.email || !body.password)) {
    return NextResponse.json({ error: 'Provide either "token" or "email" + "password"' }, { status: 400 })
  }

  let loginResult: Awaited<ReturnType<typeof loginWithF1TVCredentials>>
  try {
    loginResult = useEnvCredentials
      ? await loginWithEnvCredentials()
      : await loginWithF1TVCredentials(body.email, body.password)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  let persistedEnv = false
  let persistedRedis = false
  try {
    ;({ persistedEnv, persistedRedis } = await activateToken(loginResult.rawCookieValue))
  } catch (err) {
    return authError(err)
  }

  return NextResponse.json({
    success: true,
    persisted: persistedEnv || persistedRedis,
    token: loginResult.rawCookieValue,
    expiresAt: loginResult.expiresAt.toISOString(),
    name: `${loginResult.decoded.FirstName} ${loginResult.decoded.LastName}`,
    subscription: loginResult.decoded.SubscribedProduct,
  })
}

export async function GET() {
  let authenticated = false
  try {
    await ensureAuthenticated()
    authenticated = true
  } catch {
    authenticated = false
  }
  const decoded = getDecodedToken()

  return NextResponse.json({
    authenticated,
    name: decoded ? `${decoded.FirstName} ${decoded.LastName}` : null,
    subscription: decoded?.SubscribedProduct ?? null,
    expiresAt: decoded ? new Date(decoded.exp * 1000).toISOString() : null,
    daysRemaining: decoded
      ? Math.max(0, Math.floor((decoded.exp * 1000 - Date.now()) / 86_400_000))
      : null,
    hasEnvCredentials: Boolean(process.env.F1TV_EMAIL && process.env.F1TV_PASSWORD),
  })
}

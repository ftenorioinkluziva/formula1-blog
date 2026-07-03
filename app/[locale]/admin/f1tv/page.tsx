'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'

interface TokenStatus {
  authenticated: boolean
  name: string | null
  subscription: string | null
  expiresAt: string | null
  daysRemaining: number | null
  hasEnvCredentials: boolean
}

interface LoginResult {
  success: boolean
  persisted: boolean
  token: string
  expiresAt: string
  name: string
  subscription: string
  error?: string
}

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text.trim()) {
    return {
      error: `Empty response from server (${res.status})`,
    }
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {
      error: `Non-JSON response from server (${res.status}): ${text.slice(0, 160)}`,
    }
  }
}

function StatusBadge({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        No token
      </span>
    )
  }
  if (days <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Expired
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-medium text-yellow-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
        Expires in {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      Valid — {days}d remaining
    </span>
  )
}

export default function F1TVAdminPage() {
  const locale = useLocale()
  const authEndpoint = `/${locale}/api/f1tv/auth`
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const [tab, setTab] = useState<'paste' | 'credentials'>('paste')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pastedToken, setPastedToken] = useState('')
  const [logging, setLogging] = useState(false)
  const [result, setResult] = useState<LoginResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(authEndpoint)
      const data = await readJsonResponse(res)
      setStatus(data as unknown as TokenStatus)
    } catch {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [authEndpoint])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoadingStatus(true)
      void fetchStatus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchStatus])

  async function submitAuth(body: Record<string, string>) {
    setLogging(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await readJsonResponse(res)
      if (!res.ok || data.error) {
        setError(typeof data.error === 'string' ? data.error : 'Login failed')
      } else {
        setResult(data as unknown as LoginResult)
        setPassword('')
        setPastedToken('')
        void fetchStatus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLogging(false)
    }
  }

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    submitAuth({ email, password })
  }

  function handleEnvCredentials() {
    submitAuth({ useEnvCredentials: '1' })
  }

  function handlePaste(e: React.FormEvent) {
    e.preventDefault()
    submitAuth({ token: pastedToken.trim() })
  }

  function copyToken() {
    if (!result?.token) return
    navigator.clipboard.writeText(`F1TV_TOKEN="${result.token}"`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const needsLogin =
    !status?.authenticated ||
    (status.daysRemaining !== null && status.daysRemaining <= 7)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">F1TV Token Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the F1TV authentication token used for live timing and video streaming.
          </p>
        </div>

        {/* Current Status */}
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Current Token
            </h2>
            <button
              onClick={() => {
                setLoadingStatus(true)
                void fetchStatus()
              }}
              disabled={loadingStatus}
              className="text-xs text-muted-foreground/80 hover:text-foreground/80 disabled:opacity-40"
            >
              {loadingStatus ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loadingStatus ? (
            <div className="h-8 animate-pulse rounded bg-secondary" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <StatusBadge days={status?.daysRemaining ?? null} />
              </div>
              {status?.authenticated && (
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground/80">Account</span>
                  <span>{status.name}</span>
                  <span className="text-muted-foreground/80">Subscription</span>
                  <span>{status.subscription}</span>
                  <span className="text-muted-foreground/80">Expires at</span>
                  <span>
                    {status.expiresAt
                      ? new Date(status.expiresAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Warning banner */}
        {!loadingStatus && needsLogin && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-300">
            {!status?.authenticated || (status.daysRemaining !== null && status.daysRemaining <= 0)
              ? 'Token is expired. Login below to restore live timing and F1TV access.'
              : `Token expires in ${status.daysRemaining} day(s). Consider renewing now.`}
          </div>
        )}

        {/* Login form */}
        <div className="rounded-xl border border-border bg-card p-5">
          {result ? (
            <div className="space-y-4">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Token activated
              </h2>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <p className="font-medium">Authenticated as {result.name}</p>
                <p className="mt-0.5 text-emerald-400/70">
                  {result.subscription} — expires {new Date(result.expiresAt).toLocaleString()}
                </p>
                {result.persisted ? (
                  <p className="mt-1 text-xs text-emerald-400/60">
                    Token saved to .env.local automatically.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-yellow-400/80">
                    Token active for this session. Set the env var below to persist across restarts.
                  </p>
                )}
              </div>

              {!result.persisted && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Copy to your Vercel / server environment:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded-lg bg-secondary px-3 py-2 text-xs text-foreground/80 whitespace-nowrap">
                      F1TV_TOKEN=&quot;{result.token.slice(0, 48)}…&quot;
                    </code>
                    <button
                      onClick={copyToken}
                      className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => { setResult(null); setError(null) }}
                className="text-xs text-muted-foreground/80 hover:text-foreground/80"
              >
                ← Back
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="mb-5 flex gap-1 rounded-lg bg-secondary p-1">
                <button
                  onClick={() => { setTab('paste'); setError(null) }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === 'paste'
                      ? 'bg-card text-foreground'
                      : 'text-muted-foreground hover:text-foreground/90'
                  }`}
                >
                  Paste cookie token
                </button>
                <button
                  onClick={() => { setTab('credentials'); setError(null) }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === 'credentials'
                      ? 'bg-card text-foreground'
                      : 'text-muted-foreground hover:text-foreground/90'
                  }`}
                >
                  Email + password
                </button>
              </div>

              {tab === 'paste' ? (
                <form onSubmit={handlePaste} className="space-y-4">
                  <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground/80 mb-1">How to get the token:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Open <span className="text-foreground/90">account.formula1.com</span> in Chrome</li>
                      <li>Log in normally</li>
                      <li>Open DevTools → Application → Cookies</li>
                      <li>Find cookie named <span className="text-foreground/90">login-session</span></li>
                      <li>Copy the full Value and paste below</li>
                    </ol>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-muted-foreground" htmlFor="token">
                      login-session cookie value
                    </label>
                    <textarea
                      id="token"
                      required
                      rows={4}
                      value={pastedToken}
                      onChange={(e) => setPastedToken(e.target.value)}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground placeholder-muted-foreground/60 focus:border-muted-foreground focus:outline-none font-mono resize-none"
                      placeholder="%7B%22data%22%3A%7B%22subscriptionToken%22%3A%22eyJ..."
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={logging || !pastedToken.trim()}
                    className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-red-500 disabled:opacity-50"
                  >
                    {logging ? 'Validating…' : 'Activate token'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400/80">
                    May be blocked by F1 WAF in some environments. Use &quot;Paste cookie token&quot; if this fails.
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground/90">
                          Server environment credentials
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Uses F1TV_EMAIL and F1TV_PASSWORD without exposing them in the browser.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleEnvCredentials}
                        disabled={logging || !status?.hasEnvCredentials}
                        className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {logging ? 'Authenticating...' : 'Use env'}
                      </button>
                    </div>
                    {!status?.hasEnvCredentials && (
                      <p className="mt-2 text-xs text-yellow-400/80">
                        F1TV_EMAIL and F1TV_PASSWORD are not configured on this server.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-muted-foreground" htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:border-muted-foreground focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs text-muted-foreground" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:border-muted-foreground focus:outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={logging}
                    className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-red-500 disabled:opacity-50"
                  >
                    {logging ? 'Authenticating…' : 'Login to F1TV'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          Token is activated immediately in memory and saved to .env.local when available.
        </p>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Tv, KeyRound, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useLocale } from "next-intl"

interface F1tvCredentialsFormProps {
  initialEmail: string
  hasPasswordSet: boolean
}

export function F1tvCredentialsForm({ initialEmail, hasPasswordSet }: F1tvCredentialsFormProps) {
  const locale = useLocale()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/${locale}/api/user/profile/f1tv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: password.trim() === "" ? undefined : password,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save F1TV credentials")
      }

      setSuccess(data.message || "F1TV credentials saved and session activated successfully!")
      setPassword("") // Clear password field on success
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden mt-8">
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Tv className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">F1TV System Credentials</h3>
            <p className="text-xs text-muted-foreground">
              Configure the global credentials used by the system for auto-renewal and video streaming.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-950/40 border border-green-500/30 rounded text-xs text-green-400 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                F1TV Account Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-border/80 rounded focus:outline-none focus:border-primary text-sm text-foreground transition-colors disabled:opacity-50"
                placeholder="f1tv-user@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-[#0d0d0d] border border-border/80 rounded focus:outline-none focus:border-primary text-sm text-foreground transition-colors disabled:opacity-50"
                  placeholder={hasPasswordSet ? "•••••••• (Saved)" : "Enter password"}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  Validate & Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

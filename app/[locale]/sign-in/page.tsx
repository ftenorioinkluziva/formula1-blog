"use client"

import { useState, Suspense } from "react"
// Intentional exception: next-intl doesn't export a useSearchParams wrapper,
// so importing directly from next/navigation is required.
import { useSearchParams } from "next/navigation"
import { Link } from "@/lib/i18n/routing"
import { authClient } from "@/lib/auth-client"
import { useTranslations } from "next-intl"
import Image from "next/image"

function SignInForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message || t("signInError"))
      } else {
        // Redirect to next path or fallback to home
        window.location.href = redirectUrl
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-xs text-red-400 text-center">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="sign-in-email" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {t("emailLabel")}
        </label>
        <input
          id="sign-in-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full px-3 py-2 bg-surface-deep border border-border/80 rounded focus:outline-none focus:border-primary text-sm text-foreground transition-colors"
          placeholder="admin@example.com"
        />
      </div>

      <div>
        <label htmlFor="sign-in-password" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {t("passwordLabel")}
        </label>
        <input
          id="sign-in-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 bg-surface-deep border border-border/80 rounded focus:outline-none focus:border-primary text-sm text-foreground transition-colors"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {loading ? t("signingInButton") : t("signInButton")}
      </button>
    </form>
  )
}

export default function SignInPage() {
  const t = useTranslations("auth")

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-surface-deep text-foreground overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-red-600/5 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md px-6 py-12 sm:px-8 bg-sidebar/80 backdrop-blur-md border border-border/40 rounded-lg shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Logo"
              width={180}
              height={45}
              className="h-10 w-auto object-contain mb-6"
              priority
            />
          </Link>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-center">{t("signInTitle")}</h1>
          <p className="text-xs text-muted-foreground text-center mt-2 max-w-[280px]">
            {t("signInSubtitle")}
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-xs text-muted-foreground">Loading...</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  )
}

"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "@/lib/i18n/routing"
import { useState } from "react"

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await authClient.signOut()
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Sign out failed:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs rounded transition-colors disabled:opacity-50 cursor-pointer"
    >
      {loading ? "..." : label}
    </button>
  )
}

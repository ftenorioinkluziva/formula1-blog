"use client"

import { useState, useEffect, useRef } from "react"
import { Menu, X, User as UserIcon, LogOut, Shield, Tv, PlayCircle, BarChart3, Trophy, ChevronDown } from "lucide-react"
import Image from "next/image"
import { LanguageSwitcher } from "./language-switcher"
import { useLocale } from "next-intl"
import { useRouter, Link } from "@/lib/i18n/routing"
import { authClient } from "@/lib/auth-client"

const NAV_SECTIONS = [
  { label: "Teams", hash: "teams" },
  { label: "Drivers", hash: "drivers" },
  { label: "News", hash: "news" },
  { label: "Multimedia", hash: "multimedia" },
  { label: "Standings", hash: "standings" },
  { label: "Schedule", hash: "schedule" },
]

const NAV_PAGES = [
  { label: "Analytics", path: "/analytics" },
  { label: "Fantasy", path: "/fantasy" },
]

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const locale = useLocale()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [session, setSession] = useState<{
    authenticated: boolean
    user?: any
    profile?: { role: string; displayName?: string }
  } | null>(null)

  useEffect(() => {
    fetch(`/${locale}/api/auth/me`)
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false }))
  }, [locale])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const navLinks = [
    ...NAV_SECTIONS.map((s) => ({
      label: s.label,
      href: `/${locale}#${s.hash}`,
    })),
    ...NAV_PAGES.map((p) => ({
      label: p.label,
      href: `/${locale}${p.path}`,
    })),
  ]

  // Add Live, Replay and Admin routes if authenticated
  if (session?.authenticated) {
    navLinks.push(
      { label: "F1 Live", href: `/${locale}/live` },
      { label: "Replays", href: `/${locale}/replay` }
    )
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    setSession({ authenticated: false })
    router.push("/")
    router.refresh()
  }

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  const isAdminOrEditor = session?.profile?.role === "admin" || session?.profile?.role === "editor"

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-border/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center relative z-50">
          <Image
            src="/logo.png"
            alt="Logo"
            width={180}
            height={45}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3 relative z-50">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          {session === null ? (
            // Loading state
            <div className="h-8 w-16 bg-[#111] animate-pulse rounded" />
          ) : session.authenticated ? (
            // User Dropdown Menu
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#111111] hover:bg-[#1a1a1a] border border-border/85 text-xs font-bold uppercase tracking-wider text-foreground transition-colors cursor-pointer"
              >
                <UserIcon className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[100px] truncate">
                  {session.profile?.displayName || session.user?.name || "User"}
                </span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md bg-[#111111] border border-border/80 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-border/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Signed in as</p>
                    <p className="text-xs font-bold truncate text-foreground mt-0.5">{session.user?.email}</p>
                    {session.profile?.role && (
                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 capitalize">
                        {session.profile.role}
                      </span>
                    )}
                  </div>

                  <Link
                    href="/account"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                    My Account
                  </Link>

                  <Link
                    href="/live-timing"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    Live Timing
                  </Link>

                  <Link
                    href="/live"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                  >
                    <Tv className="h-3.5 w-3.5 text-primary" />
                    F1 Live Stream
                  </Link>

                  <Link
                    href="/replay"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-primary" />
                    VOD Replays
                  </Link>

                  {isAdminOrEditor && (
                    <>
                      <div className="border-t border-border/60 my-1" />
                      <div className="px-4 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Admin</div>
                      <Link
                        href="/admin/news"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                      >
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        Manage News
                      </Link>
                      <Link
                        href="/admin/fantasy"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                      >
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        Fantasy Admin
                      </Link>
                      <Link
                        href="/admin/f1tv"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-[#161616] transition-colors"
                      >
                        <Tv className="h-3.5 w-3.5 text-primary" />
                        F1TV Admin
                      </Link>
                    </>
                  )}

                  <div className="border-t border-border/60 my-1" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      handleSignOut()
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-[#161616] transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Sign In button
            <Link
              href="/sign-in"
              className="inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}

          <button
            className="md:hidden text-foreground p-2 relative z-50"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav - Full screen overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-background transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        aria-hidden={!mobileOpen}
      >
        <nav className="flex flex-col pt-20 px-6 h-full overflow-y-auto pb-safe" aria-label="Mobile navigation">
          {navLinks.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`py-3 text-xl font-black uppercase tracking-wider text-foreground border-b border-border transition-all duration-300 ${
                mobileOpen
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-4"
              }`}
              style={{ transitionDelay: mobileOpen ? `${i * 30 + 50}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}

          {session?.authenticated && (
            <>
              <div className="py-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">My Account</div>
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-lg font-bold uppercase tracking-wider text-foreground border-b border-border/40"
              >
                Profile & Settings
              </Link>
              <Link
                href="/live-timing"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-lg font-bold uppercase tracking-wider text-foreground border-b border-border/40"
              >
                Live Timing Dashboard
              </Link>
              {isAdminOrEditor && (
                <>
                  <div className="py-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">Admin Panel</div>
                  <Link
                    href="/admin/news"
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-lg font-bold uppercase tracking-wider text-foreground border-b border-border/40"
                  >
                    Manage News & Articles
                  </Link>
                  <Link
                    href="/admin/fantasy"
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-lg font-bold uppercase tracking-wider text-foreground border-b border-border/40"
                  >
                    Fantasy Administration
                  </Link>
                  <Link
                    href="/admin/f1tv"
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-lg font-bold uppercase tracking-wider text-foreground border-b border-border/40"
                  >
                    F1TV Credentials
                  </Link>
                </>
              )}
              <button
                onClick={() => {
                  setMobileOpen(false)
                  handleSignOut()
                }}
                className="mt-6 flex items-center justify-center px-6 py-3.5 bg-red-950/40 border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest rounded-sm"
              >
                Sign Out
              </button>
            </>
          )}

          <div
            className={`mt-8 pt-6 border-t border-border pb-8 transition-all duration-300 ${
              mobileOpen ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: mobileOpen ? `250ms` : "0ms" }}
          >
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    </header>
  )
}

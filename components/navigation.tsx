"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import { LanguageSwitcher } from "./language-switcher"
import { useLocale } from "next-intl"

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
  const locale = useLocale()

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href={`/${locale}`} className="flex items-center relative z-50">
          <Image
            src="/logo.png"
            alt="Logo"
            width={180}
            height={45}
            className="h-10 w-auto object-contain"
            priority
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-4 py-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <a
            href={`/${locale}#subscribe`}
            className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
          >
            Subscribe
          </a>
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
              className={`py-4 text-2xl font-black uppercase tracking-wider text-foreground border-b border-border transition-all duration-300 ${
                mobileOpen
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-4"
              }`}
              style={{ transitionDelay: mobileOpen ? `${i * 40 + 80}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}
          <a
            href={`/${locale}#subscribe`}
            onClick={() => setMobileOpen(false)}
            className={`mt-8 flex items-center justify-center px-6 py-4 bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest rounded-sm transition-all duration-300 ${
              mobileOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
            style={{ transitionDelay: mobileOpen ? `${navLinks.length * 40 + 120}ms` : "0ms" }}
          >
            Subscribe
          </a>
          <div
            className={`mt-6 pt-6 border-t border-border pb-8 transition-all duration-300 ${
              mobileOpen ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: mobileOpen ? `${navLinks.length * 40 + 160}ms` : "0ms" }}
          >
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    </header>
  )
}

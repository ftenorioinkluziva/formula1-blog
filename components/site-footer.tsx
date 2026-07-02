"use client"

import Image from "next/image"
import { ChevronRight } from "lucide-react"

const footerSections = [
  {
    title: "Racing",
    links: ["Teams", "Drivers", "Calendar", "Results", "Standings"],
  },
  {
    title: "Content",
    links: ["News", "Videos", "Photos", "Podcasts", "Features"],
  },
  {
    title: "About",
    links: ["About F1 Paddock Insider", "Contact", "Careers", "Media", "Partners"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Use", "Cookie Settings", "Accessibility"],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border" role="contentinfo">
      {/* Newsletter */}
      <div id="subscribe" className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 sm:gap-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground mb-1">
                Stay in the Race
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Get breaking news, race highlights, and exclusive content delivered to your inbox.
              </p>
            </div>
            <form
              className="flex flex-col sm:flex-row w-full lg:w-auto gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <label htmlFor="email-subscribe" className="sr-only">Email address</label>
              <input
                id="email-subscribe"
                type="email"
                placeholder="Enter your email"
                className="flex-1 lg:w-72 px-4 py-3 bg-secondary border border-border text-foreground text-sm rounded-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest rounded-sm hover:bg-primary/90 active:bg-primary/80 transition-colors shrink-0"
              >
                Subscribe
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-foreground mb-3 sm:mb-4">
                {section.title}
              </h4>
              <ul className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <a href="#" className="flex items-center">
              <Image
                src="/logo.png"
                alt="F1 Paddock Insider Logo"
                width={120}
                height={30}
                className="h-8 w-auto object-contain"
                priority
              />
            </a>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              F1 Paddock Insider 2026. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {["X", "IG", "YT", "TK"].map((social) => (
              <a
                key={social}
                href="#"
                className="w-9 h-9 sm:w-8 sm:h-8 bg-secondary rounded-sm flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground active:text-foreground hover:bg-secondary/80 transition-colors"
                aria-label={social}
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

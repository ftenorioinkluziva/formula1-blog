"use client"

import { useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { ReplayTimingProvider } from "@/components/live-timing/ReplayTimingProvider"
import { ReplayControls } from "@/components/replay/replay-controls"
import {
  TimingTable,
  SessionCompactHeader,
  TeamRadioList,
} from "@/components/live-timing"

export default function ReplayViewerPage() {
  const params = useParams()

  const sessionKey = params.sessionKey as string
  const locale = useLocale()
  const displayName = decodeURIComponent(sessionKey).replace(/_/g, " ")

  return (
    <ReplayTimingProvider sessionKey={sessionKey} locale={locale}>
      <div className="min-h-screen bg-[#0f0f0f] pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="flex items-center gap-3">
            <a
              href={`/${locale}/replay`}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Back
            </a>
            <h1 className="text-foreground text-lg font-bold truncate">
              {displayName}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-2 py-0.5 bg-primary/10 rounded-sm shrink-0">
              Replay
            </span>
          </div>

          <ReplayControls />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <SessionCompactHeader />
              <TimingTable />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <TeamRadioList />
            </div>
          </div>
        </div>
      </div>
    </ReplayTimingProvider>
  )
}

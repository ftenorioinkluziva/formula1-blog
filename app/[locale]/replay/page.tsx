"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale } from "next-intl"
import { useRouter } from "@/lib/i18n/routing"
import { ContentBrowser } from "@/components/live/content-browser"
import { ReplaySessionCard } from "@/components/replay/replay-session-card"
import type { RecordingMetadata } from "@/lib/live-timing/recording/types"

export default function ReplayPage() {
  const searchParams = useSearchParams()

  const router = useRouter()
  const meetingUri = searchParams.get("meeting")
  const locale = useLocale()

  const [recordings, setRecordings] = useState<RecordingMetadata[]>([])

  useEffect(() => {
    async function loadRecordings() {
      try {
        const res = await fetch(`/${locale}/api/recording`)
        if (!res.ok) return
        const data = await res.json()
        setRecordings(data.recordings ?? [])
      } catch {
        // recordings API not available
      }
    }
    loadRecordings()
  }, [locale])

  async function handleDelete(sessionKey: string) {
    const res = await fetch(`/${locale}/api/recording/${encodeURIComponent(sessionKey)}`, { method: 'DELETE' })
    if (res.ok) {
      setRecordings(prev => prev.filter(r => r.sessionKey !== sessionKey))
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        <h1 className="text-white text-lg font-semibold">Replay</h1>

        {recordings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
              Recorded Sessions
            </h2>
            <div className="space-y-2">
              {recordings.map((recording) => (
                <ReplaySessionCard
                  key={recording.sessionKey}
                  recording={recording}
                  onPlay={(key) => router.push(`/replay/${encodeURIComponent(key)}`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
            F1TV Replays
          </h2>
          <ContentBrowser initialMeetingUri={meetingUri} />
        </div>
      </div>
    </div>
  )
}

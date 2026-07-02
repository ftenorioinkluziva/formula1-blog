"use client"

import {
  LiveTimingProvider,
  PracticeTimingTable,
  SessionCompactHeader,
  TeamRadioList,
  PitStopTimeline,
  useLiveTiming,
} from "@/components/live-timing"

export default function PracticeDashboard() {
  return (
    <LiveTimingProvider pollingInterval={1000}>
      <div className="min-h-screen bg-background pt-20 pb-8">
        <div className="max-w-450 mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <SessionCompactHeader />
              <PracticeTimingTable />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <SelectedDriverStrategy />
              <TeamRadioList />
            </div>
          </div>
        </div>
      </div>
    </LiveTimingProvider>
  )
}

function SelectedDriverStrategy() {
  const { selectedDriverNumber } = useLiveTiming()

  if (!selectedDriverNumber) {
    return null
  }

  return <PitStopTimeline racingNumber={selectedDriverNumber} />
}

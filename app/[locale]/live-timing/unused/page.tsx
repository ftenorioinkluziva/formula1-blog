import {
  LiveTimingProvider,
  ChampionshipPredictionCard,
  TrackMapLive,
  RaceTraceChart,
  LapPositionChart,
  WeatherHistoryChart,
} from "@/components/live-timing"

import { useI18n } from "@/lib/i18n/client"

export default function UnusedComponentsPage() {
  const { t } = useI18n()

  return (
    <LiveTimingProvider pollingInterval={1000}>
      <div className="min-h-screen bg-background pt-20 pb-8">
        <div className="max-w-450 mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <div className="bg-surface-deep border border-yellow-900/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-yellow-400 text-sm">⚗</span>
                  <h2 className="text-yellow-400 text-sm font-bold uppercase tracking-wider">
                    {t("liveTiming.unused.sectionTitle")}
                  </h2>
                </div>
                <p className="text-gray-500 text-xs">
                  {t("liveTiming.unused.rawDataDescription")}
                </p>
              </div>
              <TrackMapLive />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <RaceTraceChart />
                <LapPositionChart />
              </div>
            </div>
            <div className="lg:col-span-3 space-y-4">
              <ChampionshipPredictionCard />
              <WeatherHistoryChart />
            </div>
          </div>
        </div>
      </div>
    </LiveTimingProvider>
  )
}

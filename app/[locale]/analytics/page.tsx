import { Navigation } from "@/components/navigation"
import { SiteFooter } from "@/components/site-footer"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ season?: string; round?: string }>
}

export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const round = sp.round ? parseInt(sp.round, 10) : undefined

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Race Analytics</h1>
            <p className="text-muted-foreground mt-1">Post-race engineering analysis and data insights</p>
          </div>
          <AnalyticsDashboard
            locale={locale}
            initialRound={round && !isNaN(round) ? round : undefined}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

import { Navigation } from "@/components/navigation"
import { SiteFooter } from "@/components/site-footer"
import { FantasyDashboard } from "@/components/fantasy/fantasy-dashboard"
import { getDb } from "@/lib/db/client"
import { raceWeekends } from "@/lib/db/schema"
import { asc, eq, sql } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { Link } from "@/lib/i18n/routing"
import { HelpCircle } from "lucide-react"
import { requireUserPage } from "@/lib/auth/guards"
import type { RaceWeekendOption } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ round?: string }>
}

interface FantasyWeekendOption extends RaceWeekendOption {
  weekendStartUtc: Date | null
  weekendEndUtc: Date | null
}

async function getFantasyWeekends(): Promise<FantasyWeekendOption[]> {
  const db = getDb()

  if (!db) {
    return []
  }

  try {
    return await db
      .select({
        round: raceWeekends.round,
        grandPrixName: raceWeekends.grandPrixName,
        country: raceWeekends.country,
        weekendStartUtc: sql<Date | null>`(
        SELECT MIN(rs.start_time_utc)
        FROM race_sessions rs
        WHERE rs.weekend_id = ${sql.raw('"race_weekends"."id"')}
      )`,
        weekendEndUtc: sql<Date | null>`(
        SELECT MAX(rs.end_time_utc)
        FROM race_sessions rs
        WHERE rs.weekend_id = ${sql.raw('"race_weekends"."id"')}
      )`,
        hasResults: sql<boolean>`EXISTS (
        SELECT 1 FROM race_sessions rs
        JOIN session_results sr ON sr.session_id = rs.id
        WHERE rs.weekend_id = ${sql.raw('"race_weekends"."id"')}
        AND rs.session_code = 'R'
      )`,
      })
      .from(raceWeekends)
      .where(eq(raceWeekends.season, 2026))
      .orderBy(asc(raceWeekends.round))
  } catch {
    return []
  }
}

function resolveCurrentFantasyRound(weekends: FantasyWeekendOption[]): number {
  if (weekends.length === 0) {
    return 1
  }

  const now = Date.now()

  const inProgressRound = weekends.find((weekend) => {
    if (!weekend.weekendStartUtc || !weekend.weekendEndUtc) {
      return false
    }

    const startMs = new Date(weekend.weekendStartUtc).getTime()
    const endMs = new Date(weekend.weekendEndUtc).getTime()

    return now >= startMs && now <= endMs
  })

  if (inProgressRound) {
    return inProgressRound.round
  }

  const nextRound = weekends.find((weekend) => {
    if (!weekend.weekendStartUtc) {
      return false
    }

    return new Date(weekend.weekendStartUtc).getTime() > now
  })

  if (nextRound) {
    return nextRound.round
  }

  const latestFinishedRound = [...weekends]
    .reverse()
    .find((weekend) => (weekend.weekendEndUtc ? new Date(weekend.weekendEndUtc).getTime() < now : false))

  if (latestFinishedRound) {
    return latestFinishedRound.round
  }

  return weekends.findLast((weekend) => weekend.hasResults)?.round ?? weekends[0].round
}

export default async function FantasyPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  
  // Guard fantasy page: require user session
  const { user } = await requireUserPage(locale)

  const sp = await searchParams
  const t = await getTranslations("fantasy")
  const weekends = await getFantasyWeekends()
  const fallbackRound = resolveCurrentFantasyRound(weekends)
  const parsedRound = sp.round ? Number.parseInt(sp.round, 10) : fallbackRound
  const initialRound = Number.isNaN(parsedRound) ? fallbackRound : parsedRound

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative mb-10 overflow-hidden rounded-xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
            <div className="pointer-events-none absolute right-6 top-6 hidden text-[120px] font-black leading-none text-secondary/40 select-none sm:block">PW</div>
            <div className="relative">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/80">{t("seasonLabel")}</div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("pageTitle")}</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("pageSubtitle")}</p>
              <Link
                href="/fantasy/rules"
                locale={locale as "en" | "pt" | "es"}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 transition-colors hover:text-foreground/80"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {t("rules.pageTitle")}
              </Link>
            </div>
          </div>

          <FantasyDashboard locale={locale} weekends={weekends} initialRound={initialRound} initialDisplayName={user.name || undefined} />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

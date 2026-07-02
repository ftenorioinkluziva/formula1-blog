import { Navigation } from "@/components/navigation"
import { SiteFooter } from "@/components/site-footer"
import { Link } from "@/lib/i18n/routing"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, Users, Building2, Radio, Target, Wallet, Lock, Lightbulb } from "lucide-react"

interface PageProps {
  params: Promise<{ locale: string }>
}

function ScoringBlock({
  icon,
  title,
  subtitle,
  items,
  accent,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  items: string[]
  accent: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground/80">{subtitle}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const isNegative = item.includes("-") && (item.includes("DNF") || item.includes("DSQ") || item.includes("lost") || item.includes("Slow") || item.includes("lento") || item.includes("Pit lento") || item.includes("Penalid") || item.includes("penalty") || item.includes("Penalización") || item.includes("perdeu") || item.includes("perdió") || item.includes("perdieron"))
          return (
            <li key={item} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isNegative ? "bg-red-500/60" : "bg-emerald-500/60"}`} />
              <span className="text-foreground/80">{item}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}

export default async function FantasyRulesPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations("fantasy.rules")

  const driverItems = [
    t("driverQualiPosition"),
    t("driverQualiDsq"),
    t("driverTeammateQuali"),
    t("driverSprintPosition"),
    t("driverSprintOvertakes"),
    t("driverSprintDnf"),
    t("driverTeammateSprint"),
    t("driverRacePosition"),
    t("driverRaceOvertakes"),
    t("driverFastestLap"),
    t("driverRaceDnf"),
    t("driverTeammateRace"),
  ]

  const teamItems = [
    t("teamQ3One"),
    t("teamQ3Both"),
    t("teamQualiDsq"),
    t("teamSprintBothFinish"),
    t("teamSprintBothTop8"),
    t("teamSprintDnf"),
    t("teamRaceBothFinish"),
    t("teamRaceBothPoints"),
    t("teamRacePodium"),
    t("teamRaceWin"),
    t("teamRaceDnf"),
    t("teamPitCrewFast"),
    t("teamPitCrewSlow"),
  ]

  const engineerItems = [
    t("engineerQualiExecution"),
    t("engineerRaceGain"),
    t("engineerPointsConversion"),
    t("engineerPositionLost"),
    t("engineerDnfPenalty"),
    t("engineerCleanRace"),
    t("engineerUndercutOvercut"),
    t("engineerScWindow"),
  ]

  const predictionItems = [
    t("predPole"),
    t("predWinner"),
    t("predPodiumExact"),
    t("predPodiumPresent"),
    t("predFastestLap"),
    t("predFastestPit"),
    t("predSafetyCarBand"),
    t("predRedFlag"),
    t("predComboPoleWinFl"),
    t("predComboExactPodium"),
  ]

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20 pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Link
            href={`/fantasy` as "/fantasy"}
            locale={locale as "en" | "pt" | "es"}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 transition-colors hover:text-foreground/80"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToFantasy")}
          </Link>

          <div className="relative mb-10 overflow-hidden rounded-xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
            <div className="pointer-events-none absolute right-6 top-6 hidden text-[120px] font-black leading-none text-secondary/40 select-none sm:block">?</div>
            <div className="relative">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/80">Fantasy Pitwall</div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("pageTitle")}</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("pageSubtitle")}</p>
            </div>
          </div>

          <section className="mb-10">
            <h2 className="mb-3 text-xl font-bold text-foreground">{t("overview")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("overviewText")}</p>
          </section>

          <section className="mb-10">
            <h2 className="mb-5 text-xl font-bold text-foreground">{t("howItWorks")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-sm font-bold text-red-400">{t("step1Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("step1Text")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-sm font-bold text-amber-400">{t("step2Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("step2Text")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-sm font-bold text-blue-400">{t("step3Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("step3Text")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-sm font-bold text-emerald-400">{t("step4Title")}</h3>
                <p className="text-sm text-muted-foreground">{t("step4Text")}</p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-2 text-xl font-bold text-foreground">{t("scoringTitle")}</h2>
            <p className="mb-6 text-sm text-muted-foreground/80">{t("scoringPhilosophy")}</p>
            <div className="space-y-4">
              <ScoringBlock
                icon={<Users className="h-5 w-5 text-red-400" />}
                title={t("driverTitle")}
                subtitle={t("driverSubtitle")}
                items={driverItems}
                accent="bg-red-500/10"
              />
              <ScoringBlock
                icon={<Building2 className="h-5 w-5 text-blue-400" />}
                title={t("teamTitle")}
                subtitle={t("teamSubtitle")}
                items={teamItems}
                accent="bg-blue-500/10"
              />
              <ScoringBlock
                icon={<Radio className="h-5 w-5 text-amber-400" />}
                title={t("engineerTitle")}
                subtitle={t("engineerSubtitle")}
                items={engineerItems}
                accent="bg-amber-500/10"
              />
              <ScoringBlock
                icon={<Target className="h-5 w-5 text-emerald-400" />}
                title={t("predictionsTitle")}
                subtitle={t("predictionsSubtitle")}
                items={predictionItems}
                accent="bg-emerald-500/10"
              />
            </div>
          </section>

          <section className="mb-10 grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
              title={t("budgetTitle")}
              text={t("budgetText")}
            />
            <InfoCard
              icon={<Lock className="h-4 w-4 text-muted-foreground" />}
              title={t("lockTitle")}
              text={t("lockText")}
            />
          </section>

          <section className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-bold text-foreground">{t("tipsTitle")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[t("tip1"), t("tip2"), t("tip3"), t("tip4")].map((tip, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                  {tip}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

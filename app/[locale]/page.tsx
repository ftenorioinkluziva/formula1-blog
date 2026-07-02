import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { StandingsTicker } from "@/components/standings-ticker"
import { TeamProfiles } from "@/components/team-profiles"
import { DriverProfiles } from "@/components/driver-profiles"
import { NewsSection } from "@/components/news-section"
import { MultimediaSection } from "@/components/multimedia-section"
import { StandingsSection } from "@/components/standings-section"
import { ScheduleSection } from "@/components/schedule-section"
import { SiteFooter } from "@/components/site-footer"
import { SessionBanner } from "@/components/session-banner"
import { ChampionshipPredictionCompact } from "@/components/championship-prediction-compact"

export default function Home() {
  return (
    <>
      <Navigation />
      <SessionBanner />
      <main>
        <ChampionshipPredictionCompact />
        <HeroSection />
        <StandingsTicker />
        <TeamProfiles />
        <DriverProfiles />
        <NewsSection />
        <MultimediaSection />
        <StandingsSection />
        <ScheduleSection />
      </main>
      <SiteFooter />
    </>
  )
}

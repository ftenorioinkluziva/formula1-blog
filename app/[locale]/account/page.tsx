import { requireUserPage } from "@/lib/auth/guards"
import { Navigation } from "@/components/navigation"
import { SiteFooter } from "@/components/site-footer"
import { getTranslations } from "next-intl/server"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { formatLocalDate } from "@/lib/localized-date-time"
import { Shield, User as UserIcon, Calendar, Mail } from "lucide-react"
import { F1tvCredentialsForm } from "@/components/auth/f1tv-credentials-form"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params
  
  // Fetch session and automatically redirect if not logged in
  const { user, profile } = await requireUserPage(locale)
  const t = await getTranslations("auth")

  const role = profile?.role || "user"
  const displayName = profile?.displayName || user.name || "User"
  const memberSince = formatLocalDate(user.createdAt.toISOString(), locale)

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative mb-8 overflow-hidden rounded-xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("accountTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("accountSubtitle")}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              {/* Profile Card Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <UserIcon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                    <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
                      <Shield className="h-3 w-3" />
                      {role}
                    </span>
                  </div>
                </div>
                <div>
                  <SignOutButton label={t("logoutButton")} />
                </div>
              </div>

              {/* Detail fields */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {t("emailLabel")}
                  </div>
                  <p className="text-sm font-medium text-foreground">{user.email}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("createdAtLabel")}
                  </div>
                  <p className="text-sm font-medium text-foreground">{memberSince}</p>
                </div>
              </div>
            </div>
          </div>

          {role === "admin" && (
            <F1tvCredentialsForm
              initialEmail={profile?.f1tvEmail || ""}
              hasPasswordSet={!!profile?.f1tvPassword}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

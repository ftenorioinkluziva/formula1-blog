import { requireAdminPage } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function FantasyAdminLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  
  // Require strictly the 'admin' role to access Fantasy Admin page
  await requireAdminPage(locale)

  return <>{children}</>
}

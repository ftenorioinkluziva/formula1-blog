import { requireAnyRolePage } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  
  // Require at least 'editor' or 'admin' role to view any page under /admin
  await requireAnyRolePage(locale, ["editor", "admin"])

  return <>{children}</>
}

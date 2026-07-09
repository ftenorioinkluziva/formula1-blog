import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }
  return NextResponse.json({
    authenticated: true,
    user: session.user,
    profile: session.profile,
  })
}

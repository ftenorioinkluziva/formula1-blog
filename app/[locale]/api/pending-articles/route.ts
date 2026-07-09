import { NextResponse } from "next/server"
import { getPendingArticles } from "@/lib/db/pending-articles"
import { requireAnyRole } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const articles = await getPendingArticles()
    return NextResponse.json({ articles }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ articles: [] }, { status: 500 })
  }
}

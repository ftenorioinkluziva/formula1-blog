import { NextResponse } from "next/server"
import { getPendingArticles } from "@/lib/db/pending-articles"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const articles = await getPendingArticles()
    return NextResponse.json({ articles }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ articles: [] }, { status: 500 })
  }
}

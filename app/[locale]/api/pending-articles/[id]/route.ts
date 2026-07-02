import { NextRequest, NextResponse } from "next/server"
import {
  getPendingArticleById,
  updatePendingArticle,
  publishPendingArticle,
  ignorePendingArticle,
} from "@/lib/db/pending-articles"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const article = await getPendingArticleById(Number(id))
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(article)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const data = await req.json()
  const ok = await updatePendingArticle(Number(id), data)
  if (!ok) return NextResponse.json({ error: "Falha ao atualizar" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { action } = await req.json()

  if (action === "publish") {
    const newsId = await publishPendingArticle(Number(id))
    if (!newsId) return NextResponse.json({ error: "Falha ao publicar" }, { status: 500 })
    return NextResponse.json({ ok: true, newsId })
  }

  if (action === "ignore") {
    const ok = await ignorePendingArticle(Number(id))
    if (!ok) return NextResponse.json({ error: "Falha ao ignorar" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
}

import { NextRequest, NextResponse } from "next/server"
import {
  getPendingArticleById,
  updatePendingArticle,
  publishPendingArticle,
  ignorePendingArticle,
} from "@/lib/db/pending-articles"
import { requireAnyRole } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  const { id } = await params
  const article = await getPendingArticleById(Number(id))
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(article)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

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
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  const { id } = await params
  const { action } = await req.json()

  if (action === "publish") {
    const newsId = await publishPendingArticle(Number(id))
    if (!newsId) return NextResponse.json({ error: "Falha ao publicar" }, { status: 500 })
    
    // Log the publish action
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "publish_pending_article",
      targetType: "pending_article",
      targetId: id,
      metadataJson: { newsId },
    })

    return NextResponse.json({ ok: true, newsId })
  }

  if (action === "ignore") {
    const ok = await ignorePendingArticle(Number(id))
    if (!ok) return NextResponse.json({ error: "Falha ao ignorar" }, { status: 500 })
    
    // Log the ignore action
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "ignore_pending_article",
      targetType: "pending_article",
      targetId: id,
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
}

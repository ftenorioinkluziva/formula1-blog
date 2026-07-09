import { NextRequest, NextResponse } from "next/server"
import { getNewsList, insertNews } from "@/lib/db/news"
import { requireAnyRole } from "@/lib/auth/guards"
import { logAdminAction } from "@/lib/db/audit"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    const payload = await getNewsList()

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { featuredArticle: null, articles: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAnyRole(["editor", "admin"])
  if (session instanceof Response) return session

  try {
    const news = await req.json()
    // Validação básica
    if (!news.title || !news.excerpt || !news.category || !news.readTime || !news.date || !news.author || !news.body) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (!Array.isArray(news.body)) {
      return NextResponse.json({ error: 'O campo body deve ser um array.' }, { status: 400 })
    }
    const id = await insertNews({
      title: news.title,
      excerpt: news.excerpt,
      category: news.category,
      readTime: news.readTime,
      date: news.date,
      comments: news.comments,
      author: news.author,
      body: news.body,
      image: news.image,
    })
    if (!id) {
      return NextResponse.json({ error: 'Falha ao inserir notícia no banco.' }, { status: 500 })
    }

    // Log the news creation action
    await logAdminAction({
      actorUserId: session.user.id,
      actorRole: session.profile?.role || "user",
      action: "create_news",
      targetType: "news",
      targetId: String(id),
      metadataJson: { title: news.title },
    })

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao processar notícia.' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from "next/server"
import { getNewsList } from "@/lib/db/news"
import { insertNews } from '@/lib/db/news'

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
    return NextResponse.json({ ok: true, id })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao processar notícia.' }, { status: 500 })
  }
}

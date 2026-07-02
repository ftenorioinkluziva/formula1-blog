import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { newsArticles } from '@/lib/db/schema'
import { parseNewsDate } from '@/lib/db/news-date'

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const numId = Number(id)
    const data = await req.json()
    const db = getDb()
    if (!db) return NextResponse.json({ error: 'DB não disponível' }, { status: 500 })
    // Validação básica
    if (!data.title || !data.excerpt || !data.category || !data.readTime || !data.date || !data.author || !data.body) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (!Array.isArray(data.body)) {
      return NextResponse.json({ error: 'O campo body deve ser um array.' }, { status: 400 })
    }
    await db.update(newsArticles).set({
      title: data.title,
      excerpt: data.excerpt,
      category: data.category,
      readTime: data.readTime,
      publishedDate: parseNewsDate(data.date),
      comments: data.comments ?? null,
      author: data.author,
      body: data.body,
      imageUrl: data.image ?? null,
    }).where(eq(newsArticles.id, numId))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao atualizar notícia.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const numId = Number(id)
    const db = getDb()
    if (!db) return NextResponse.json({ error: 'DB não disponível' }, { status: 500 })
    await db.delete(newsArticles).where(eq(newsArticles.id, numId))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao excluir notícia.' }, { status: 500 })
  }
}

"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useLocale } from "next-intl"

interface GalleryImage {
  id: number
  imageUrl: string
  caption: string | null
  galleryTitle: string
}

interface ImagePickerProps {
  value: string
  onChange: (url: string) => void
  apiBase: string
}

function ImagePicker({ value, onChange, apiBase }: ImagePickerProps) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const dialogRef = useRef<HTMLDivElement>(null)

  const loadImages = useCallback(async () => {
    if (images.length > 0) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/gallery-images`)
      const data = await res.json()
      setImages(data.images ?? [])
    } catch {
      setImages([])
    }
    setLoading(false)
  }, [apiBase, images.length])

  const handleOpen = () => {
    setOpen(true)
    loadImages()
  }

  const filtered = search
    ? images.filter(
        (img) =>
          img.galleryTitle.toLowerCase().includes(search.toLowerCase()) ||
          (img.caption ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : images

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          placeholder="Imagem (URL)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
        />
        <button
          type="button"
          onClick={handleOpen}
          className="px-3 py-1 text-xs bg-secondary/80 text-foreground/90 rounded border border-border hover:bg-muted-foreground whitespace-nowrap"
        >
          Escolher
        </button>
      </div>

      {value && (
        <div className="relative w-full h-36 rounded overflow-hidden border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-background/80 text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-background"
          >
            ✕
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div ref={dialogRef} className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Selecionar imagem</span>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground/90 text-lg leading-none">✕</button>
            </div>
            <div className="px-4 py-2 border-b border-border">
              <input
                placeholder="Buscar por galeria ou legenda..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="text-sm text-muted-foreground text-center py-8">Carregando imagens...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground/80 text-center py-8">Nenhuma imagem encontrada.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filtered.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => { onChange(img.imageUrl); setOpen(false) }}
                      className={`relative group rounded overflow-hidden border-2 transition-colors ${value === img.imageUrl ? "border-blue-500" : "border-transparent hover:border-muted-foreground"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.imageUrl} alt={img.caption ?? ""} className="w-full h-24 object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-xs text-foreground/90 px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {img.caption ?? img.galleryTitle}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PendingArticle {
  id: number
  filename: string
  template: string
  source: string
  generatedAt: string
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  author: string
  image?: string
  body: string[]
  status: string
}

interface PublishedArticle {
  id: number
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  author: string
  image?: string
  body: string[]
}

interface SyncedNewsItem {
  filename: string
  source: string
  title: string
  date: string
  time?: string | null
  url: string
  fetchedAt?: string
  excerpt?: string
  author?: string
  readTime?: string
}

type Tab = "pending" | "published" | "synced"

export default function AdminNewsPage() {
  const locale = useLocale()
  const apiBase = useMemo(() => `/${locale}/api`, [locale])
  const [tab, setTab] = useState<Tab>("pending")

  // ── Pending state ────────────────────────────────────────────────────────────
  const [pending, setPending] = useState<PendingArticle[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [editing, setEditing] = useState<PendingArticle | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<number | null>(null)

  // ── Published state ──────────────────────────────────────────────────────────
  const [published, setPublished] = useState<PublishedArticle[]>([])
  const [loadingPublished, setLoadingPublished] = useState(false)
  const [editingPublished, setEditingPublished] = useState<PublishedArticle | null>(null)
  const [savingPublished, setSavingPublished] = useState(false)

  // ── Synced news state ────────────────────────────────────────────────────────
  const [syncedNews, setSyncedNews] = useState<SyncedNewsItem[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loadingSynced, setLoadingSynced] = useState(false)

  // ── Shared feedback ──────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clearFeedback = () => { setError(null); setSuccess(null) }

  const fetchPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const res = await fetch(`${apiBase}/pending-articles`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load pending articles")
      const data = await res.json()
      setPending(data.articles ?? [])
    } catch {
      setPending([])
      setError("Erro ao carregar artigos pendentes.")
    } finally {
      setLoadingPending(false)
    }
  }, [apiBase])

  const fetchPublished = useCallback(async () => {
    setLoadingPublished(true)
    try {
      const res = await fetch(`${apiBase}/news`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load published articles")
      const data = await res.json()
      setPublished(data.articles ?? [])
    } catch {
      setPublished([])
      setError("Erro ao carregar notícias publicadas.")
    } finally {
      setLoadingPublished(false)
    }
  }, [apiBase])

  const fetchSyncedNews = useCallback(async () => {
    setLoadingSynced(true)
    try {
      const res = await fetch(`${apiBase}/news-sync`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load synced news")
      const data = await res.json()
      setSyncedNews(data.items ?? [])
      setSyncedAt(data.syncedAt ?? null)
    } catch {
      setSyncedNews([])
      setSyncedAt(null)
      setError("Erro ao carregar notícias coletadas.")
    } finally {
      setLoadingSynced(false)
    }
  }, [apiBase])

  useEffect(() => {
    const pendingTimer = window.setTimeout(() => {
      void fetchPending()
    }, 0)
    const publishedTimer = window.setTimeout(() => {
      void fetchPublished()
    }, 0)
    const syncedTimer = window.setTimeout(() => {
      void fetchSyncedNews()
    }, 0)

    return () => {
      window.clearTimeout(pendingTimer)
      window.clearTimeout(publishedTimer)
      window.clearTimeout(syncedTimer)
    }
  }, [fetchPending, fetchPublished, fetchSyncedNews])

  // ── Pending handlers ─────────────────────────────────────────────────────────
  const handleSavePending = async () => {
    if (!editing) return
    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/pending-articles/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          excerpt: editing.excerpt,
          category: editing.category,
          readTime: editing.readTime,
          date: editing.date,
          author: editing.author,
          image: editing.image,
          body: editing.body,
        }),
      })
      if (!res.ok) throw new Error()
      setSuccess("Artigo salvo.")
      setEditing(null)
      void fetchPending()
    } catch {
      setError("Erro ao salvar artigo.")
    }
    setSaving(false)
  }

  const handlePublish = async (id: number) => {
    clearFeedback()
    setPublishing(id)
    try {
      const res = await fetch(`${apiBase}/pending-articles/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      if (!res.ok) throw new Error()
      setSuccess("Artigo publicado com sucesso!")
      void fetchPending()
      void fetchPublished()
    } catch {
      setError("Erro ao publicar artigo.")
    }
    setPublishing(null)
  }

  const handleIgnore = async (id: number) => {
    clearFeedback()
    try {
      const res = await fetch(`${apiBase}/pending-articles/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore" }),
      })
      if (!res.ok) throw new Error()
      setSuccess("Artigo ignorado.")
      void fetchPending()
    } catch {
      setError("Erro ao ignorar artigo.")
    }
  }

  // ── Published handlers ───────────────────────────────────────────────────────
  const handleSavePublished = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPublished) return
    clearFeedback()
    setSavingPublished(true)
    try {
      const res = await fetch(`${apiBase}/news/${editingPublished.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPublished),
      })
      if (!res.ok) throw new Error()
      setSuccess("Notícia atualizada com sucesso!")
      setEditingPublished(null)
      fetchPublished()
    } catch {
      setError("Erro ao salvar notícia.")
    }
    setSavingPublished(false)
  }

  const handleDeletePublished = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir esta notícia?")) return
    clearFeedback()
    try {
      const res = await fetch(`${apiBase}/news/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setSuccess("Notícia excluída com sucesso!")
      fetchPublished()
    } catch {
      setError("Erro ao excluir notícia.")
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-4 bg-background rounded border border-border shadow-sm min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-foreground">Administração de Notícias</h1>

      {/* Feedback */}
      {(error || success) && (
        <div className={`mb-4 text-center text-sm py-2 px-3 rounded ${error ? "bg-red-900 text-red-200" : "bg-green-900 text-green-200"}`}>
          {error || success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "pending" ? "border-blue-500 text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground/90"}`}
        >
          Pendentes {pending.length > 0 && <span className="ml-1 bg-blue-700 text-foreground text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button
          onClick={() => setTab("published")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "published" ? "border-blue-500 text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground/90"}`}
        >
          Publicados
        </button>
        <button
          onClick={() => setTab("synced")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "synced" ? "border-blue-500 text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground/90"}`}
        >
          Coletadas {syncedNews.length > 0 && <span className="ml-1 bg-blue-700 text-foreground text-xs px-1.5 py-0.5 rounded-full">{syncedNews.length}</span>}
        </button>
      </div>

      {/* ── TAB: PENDENTES ── */}
      {tab === "pending" && (
        <div>
          {editing ? (
            <div className="border border-border rounded bg-card p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-muted-foreground font-mono">{editing.filename}</span>
                <span className="text-xs bg-secondary/80 text-foreground/80 px-2 py-0.5 rounded">{editing.template}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  placeholder="Título"
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                />
                <textarea
                  placeholder="Resumo"
                  value={editing.excerpt}
                  onChange={e => setEditing({ ...editing, excerpt: e.target.value })}
                  className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Categoria"
                    value={editing.category}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                  <input
                    placeholder="Tempo de leitura"
                    value={editing.readTime}
                    onChange={e => setEditing({ ...editing, readTime: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Data (DD/MM/YYYY)"
                    value={editing.date}
                    onChange={e => setEditing({ ...editing, date: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                  <input
                    placeholder="Autor"
                    value={editing.author}
                    onChange={e => setEditing({ ...editing, author: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                </div>
                <ImagePicker
                  value={editing.image ?? ""}
                  apiBase={apiBase}
                  onChange={(url) => setEditing({ ...editing, image: url })}
                />
                <textarea
                  placeholder="Body (1 seção por linha)"
                  value={editing.body.join("\n\n")}
                  onChange={e => setEditing({ ...editing, body: e.target.value.split("\n\n").filter(s => s.trim()) })}
                  className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border font-mono"
                  rows={12}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSavePending}
                  disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 text-foreground rounded text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => handlePublish(editing.id)}
                  disabled={publishing === editing.id}
                  className="px-4 py-1.5 bg-green-700 text-foreground rounded text-sm hover:bg-green-600 disabled:opacity-60"
                >
                  {publishing === editing.id ? "Publicando..." : "Publicar"}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-1.5 bg-secondary/80 text-foreground/90 rounded text-sm hover:bg-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : loadingPending ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground/60">Nenhum artigo pendente.</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {pending.map(a => (
                <li key={a.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs bg-secondary/80 text-foreground/80 px-1.5 py-0.5 rounded">{a.template}</span>
                        <span className="text-xs text-muted-foreground/80">{new Date(a.generatedAt).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="font-medium text-foreground truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{a.excerpt}</div>
                      <div className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">{a.filename}</div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => { clearFeedback(); setEditing(a) }}
                        className="px-2 py-1 text-xs bg-yellow-900 text-yellow-100 rounded border border-yellow-700 hover:bg-yellow-800"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handlePublish(a.id)}
                        disabled={publishing === a.id}
                        className="px-2 py-1 text-xs bg-green-900 text-green-100 rounded border border-green-700 hover:bg-green-800 disabled:opacity-60"
                      >
                        {publishing === a.id ? "..." : "Publicar"}
                      </button>
                      <button
                        onClick={() => handleIgnore(a.id)}
                        className="px-2 py-1 text-xs bg-secondary text-muted-foreground rounded border border-border hover:bg-secondary/80"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TAB: PUBLICADOS ── */}
      {tab === "published" && (
        <div>
          {editingPublished && (
            <div className="mb-4 p-4 border border-border rounded bg-card">
              <form onSubmit={handleSavePublished} className="space-y-2">
                <input
                  placeholder="Título"
                  value={editingPublished.title}
                  onChange={e => setEditingPublished({ ...editingPublished, title: e.target.value })}
                  className="w-full border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                />
                <textarea
                  placeholder="Resumo"
                  value={editingPublished.excerpt}
                  onChange={e => setEditingPublished({ ...editingPublished, excerpt: e.target.value })}
                  className="w-full border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Categoria"
                    value={editingPublished.category}
                    onChange={e => setEditingPublished({ ...editingPublished, category: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                  <input
                    placeholder="Autor"
                    value={editingPublished.author}
                    onChange={e => setEditingPublished({ ...editingPublished, author: e.target.value })}
                    className="border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border"
                  />
                </div>
                <ImagePicker
                  value={editingPublished.image ?? ""}
                  apiBase={apiBase}
                  onChange={(url) => setEditingPublished({ ...editingPublished, image: url })}
                />
                <textarea
                  placeholder="Body (1 parágrafo por linha)"
                  value={editingPublished.body.join("\n")}
                  onChange={e => setEditingPublished({ ...editingPublished, body: e.target.value.split("\n") })}
                  className="w-full border px-2 py-1 rounded text-sm bg-secondary text-foreground border-border font-mono"
                  rows={8}
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingPublished} className="px-4 py-1.5 bg-blue-600 text-foreground rounded text-sm hover:bg-blue-700 disabled:opacity-60">
                    {savingPublished ? "Salvando..." : "Salvar"}
                  </button>
                  <button type="button" onClick={() => setEditingPublished(null)} className="px-4 py-1.5 bg-secondary/80 text-foreground/90 rounded text-sm hover:bg-muted-foreground">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingPublished ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : published.length === 0 ? (
            <div className="text-sm text-muted-foreground/60">Nenhuma notícia encontrada.</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {published.map(n => (
                <li key={n.id} className="py-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-foreground">{n.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{n.date} — {n.author}</div>
                    <div className="text-xs text-muted-foreground/80 truncate">{n.excerpt}</div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => { clearFeedback(); setEditingPublished(n) }}
                      className="px-2 py-1 text-xs bg-yellow-900 text-yellow-100 rounded border border-yellow-700 hover:bg-yellow-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeletePublished(n.id)}
                      className="px-2 py-1 text-xs bg-red-900 text-red-100 rounded border border-red-700 hover:bg-red-800"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TAB: COLETADAS ── */}
      {tab === "synced" && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {syncedAt ? `Último sync: ${new Date(syncedAt).toLocaleString("pt-BR")}` : "Nenhum sync encontrado."}
            </span>
            <button
              type="button"
              onClick={() => { setLoadingSynced(true); void fetchSyncedNews() }}
              className="px-2 py-1 rounded border border-border bg-secondary text-foreground/80 hover:bg-secondary/80"
            >
              Atualizar
            </button>
          </div>

          {loadingSynced ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : syncedNews.length === 0 ? (
            <div className="text-sm text-muted-foreground/60">Nenhuma notícia coletada pelo sync-news.</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {syncedNews.map((item) => (
                <li key={`${item.source}-${item.filename}`} className="py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs bg-secondary/80 text-foreground/80 px-1.5 py-0.5 rounded uppercase">{item.source}</span>
                        <span className="text-xs text-muted-foreground/80">{item.date}{item.time ? ` ${item.time}` : ""}</span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground hover:text-blue-300 truncate block"
                      >
                        {item.title}
                      </a>
                      {item.excerpt && <div className="text-xs text-muted-foreground truncate mt-0.5">{item.excerpt}</div>}
                      <div className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">{item.filename}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

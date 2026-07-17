"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ImagePlus, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { useLocale } from "next-intl"

interface AdminGallery {
  id: number
  title: string
  category: string
  coverImageUrl: string | null
  folderKey: string | null
  sortOrder: number
  imageCount: number
}

interface AdminGalleryImage {
  id: number
  galleryId: number
  imageUrl: string
  caption: string | null
  sortOrder: number
}

interface GalleryForm {
  title: string
  category: string
  coverImageUrl: string
  folderKey: string
  sortOrder: string
}

interface ImageForm {
  imageUrl: string
  caption: string
  sortOrder: string
}

const emptyGalleryForm: GalleryForm = {
  title: "",
  category: "",
  coverImageUrl: "",
  folderKey: "",
  sortOrder: "0",
}

const emptyImageForm: ImageForm = {
  imageUrl: "",
  caption: "",
  sortOrder: "0",
}

function toGalleryForm(gallery: AdminGallery): GalleryForm {
  return {
    title: gallery.title,
    category: gallery.category,
    coverImageUrl: gallery.coverImageUrl ?? "",
    folderKey: gallery.folderKey ?? "",
    sortOrder: String(gallery.sortOrder),
  }
}

function toImageForm(image: AdminGalleryImage): ImageForm {
  return {
    imageUrl: image.imageUrl,
    caption: image.caption ?? "",
    sortOrder: String(image.sortOrder),
  }
}

function parseSortOrder(value: string): number {
  const numeric = Number(value)
  return Number.isInteger(numeric) ? numeric : 0
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return typeof data.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function AdminMultimediaGalleriesPage() {
  const locale = useLocale()
  const apiBase = `/${locale}/api/admin/galleries`

  const [galleries, setGalleries] = useState<AdminGallery[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedGallery, setSelectedGallery] = useState<AdminGallery | null>(null)
  const [images, setImages] = useState<AdminGalleryImage[]>([])
  const [galleryForm, setGalleryForm] = useState<GalleryForm>(emptyGalleryForm)
  const [imageDraft, setImageDraft] = useState<ImageForm>(emptyImageForm)
  const [editingImages, setEditingImages] = useState<Record<number, ImageForm>>({})
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearFeedback = () => {
    setMessage(null)
    setError(null)
  }

  const loadGalleries = useCallback(
    async (preferredId?: number | null) => {
      try {
        const res = await fetch(apiBase, { cache: "no-store" })
        if (!res.ok) throw new Error(await readApiError(res, "Erro ao carregar galerias."))
        const data = await res.json()
        const nextGalleries = (data.galleries ?? []) as AdminGallery[]
        setGalleries(nextGalleries)

        if (preferredId !== undefined) {
          setSelectedId(preferredId)
        } else if (selectedId && nextGalleries.some((gallery) => gallery.id === selectedId)) {
          setSelectedId(selectedId)
        } else {
          setSelectedId(nextGalleries[0]?.id ?? null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar galerias.")
        setGalleries([])
      } finally {
      }
    },
    [apiBase, selectedId],
  )

  const loadGalleryDetail = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`${apiBase}/${id}`, { cache: "no-store" })
        if (!res.ok) throw new Error(await readApiError(res, "Erro ao carregar galeria."))
        const data = await res.json()
        const gallery = data.gallery as AdminGallery
        const galleryImages = (data.images ?? []) as AdminGalleryImage[]
        setSelectedGallery(gallery)
        setGalleryForm(toGalleryForm(gallery))
        setImages(galleryImages)
        setEditingImages(Object.fromEntries(galleryImages.map((image) => [image.id, toImageForm(image)])))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar galeria.")
        setSelectedGallery(null)
        setImages([])
      } finally {
        setLoadingDetail(false)
      }
    },
    [apiBase],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoadingList(true)
      void loadGalleries()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadGalleries])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId === null) {
        setSelectedGallery(null)
        setGalleryForm(emptyGalleryForm)
        setImages([])
        setEditingImages({})
        return
      }

      setLoadingDetail(true)
      void loadGalleryDetail(selectedId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadGalleryDetail, selectedId])

  const galleryPayload = {
    title: galleryForm.title,
    category: galleryForm.category,
    coverImageUrl: galleryForm.coverImageUrl,
    folderKey: galleryForm.folderKey,
    sortOrder: parseSortOrder(galleryForm.sortOrder),
  }

  const handleSaveGallery = async () => {
    if (!selectedId) return

    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(galleryPayload),
      })
      if (!res.ok) throw new Error(await readApiError(res, "Erro ao salvar galeria."))
      setMessage("Galeria salva.")
      await loadGalleries(selectedId)
      await loadGalleryDetail(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar galeria.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGallery = async () => {
    if (!selectedGallery) return
    if (!window.confirm(`Excluir a galeria "${selectedGallery.title}" e todas as imagens vinculadas?`)) return

    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${selectedGallery.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await readApiError(res, "Erro ao excluir galeria."))
      setMessage("Galeria excluída.")
      setSelectedId(null)
      await loadGalleries()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir galeria.")
    } finally {
      setSaving(false)
    }
  }

  const handleAddImage = async () => {
    if (!selectedGallery) return
    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${selectedGallery.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageDraft.imageUrl,
          caption: imageDraft.caption,
          sortOrder: parseSortOrder(imageDraft.sortOrder),
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res, "Erro ao adicionar imagem."))
      setMessage("Imagem adicionada.")
      setImageDraft(emptyImageForm)
      await loadGalleries(selectedGallery.id)
      await loadGalleryDetail(selectedGallery.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar imagem.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveImage = async (imageId: number) => {
    if (!selectedGallery) return
    const form = editingImages[imageId]
    if (!form) return

    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${selectedGallery.id}/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: form.imageUrl,
          caption: form.caption,
          sortOrder: parseSortOrder(form.sortOrder),
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res, "Erro ao salvar imagem."))
      setMessage("Imagem salva.")
      await loadGalleryDetail(selectedGallery.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar imagem.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteImage = async (image: AdminGalleryImage) => {
    if (!selectedGallery) return
    if (!window.confirm("Excluir esta imagem da galeria?")) return

    clearFeedback()
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/${selectedGallery.id}/images/${image.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await readApiError(res, "Erro ao excluir imagem."))
      setMessage("Imagem excluída.")
      await loadGalleries(selectedGallery.id)
      await loadGalleryDetail(selectedGallery.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir imagem.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administração de Galerias</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie as galerias da seção Multimedia usando URLs Cloudinary.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadGalleries(selectedId)}
              className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm text-foreground/90 hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className={`mb-4 rounded px-4 py-3 text-sm ${error ? "bg-red-950 text-red-200" : "bg-green-950 text-green-200"}`}>
            {error ?? message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="rounded border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Galerias</h2>
              <p className="text-xs text-muted-foreground/80">{loadingList ? "Carregando..." : `${galleries.length} cadastradas`}</p>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-2">
              {galleries.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground/80">Nenhuma galeria cadastrada.</div>
              )}
              {galleries.map((gallery) => (
                <button
                  key={gallery.id}
                  type="button"
                  onClick={() => {
                    clearFeedback()
                    setSelectedId(gallery.id)
                  }}
                  className={`mb-2 w-full rounded border p-3 text-left transition-colors ${
                    selectedId === gallery.id
                      ? "border-blue-500 bg-blue-950/40"
                      : "border-border bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-secondary">
                      {gallery.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={gallery.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground/80">sem capa</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{gallery.title}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{gallery.category}</div>
                      <div className="mt-1 text-xs text-muted-foreground/80">
                        {gallery.imageCount} imagens · ordem {gallery.sortOrder}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded border border-border bg-background p-4">
            {!selectedId ? (
              <div className="flex min-h-80 items-center justify-center rounded border border-dashed border-border text-center">
                <div>
                  <h2 className="text-lg font-semibold text-foreground/90">Selecione uma galeria</h2>
                  <p className="mt-1 text-sm text-muted-foreground/80">
                    Use a lista ao lado para editar metadados e imagens de uma galeria existente.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedGallery?.title ?? "Galeria"}</h2>
                    <p className="text-sm text-muted-foreground/80">{selectedGallery?.imageCount ?? 0} imagens cadastradas</p>
                  </div>
                  {selectedGallery && (
                <button
                  type="button"
                  onClick={handleDeleteGallery}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-100 hover:bg-red-900 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
                  )}
                </div>

                {loadingDetail ? (
              <div className="py-12 text-center text-sm text-muted-foreground/80">Carregando galeria...</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-foreground/80">Título</span>
                    <input
                      value={galleryForm.title}
                      onChange={(event) => setGalleryForm({ ...galleryForm, title: event.target.value })}
                      className="w-full rounded border border-border bg-card px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-foreground/80">Categoria</span>
                    <input
                      value={galleryForm.category}
                      onChange={(event) => setGalleryForm({ ...galleryForm, category: event.target.value })}
                      className="w-full rounded border border-border bg-card px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-foreground/80">Folder key</span>
                    <input
                      value={galleryForm.folderKey}
                      onChange={(event) => setGalleryForm({ ...galleryForm, folderKey: event.target.value })}
                      className="w-full rounded border border-border bg-card px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-foreground/80">Ordem</span>
                    <input
                      type="number"
                      value={galleryForm.sortOrder}
                      onChange={(event) => setGalleryForm({ ...galleryForm, sortOrder: event.target.value })}
                      className="w-full rounded border border-border bg-card px-3 py-2 text-foreground"
                    />
                  </label>
                </div>

                <label className="mt-3 block space-y-1 text-sm">
                  <span className="text-foreground/80">URL da capa</span>
                  <input
                    value={galleryForm.coverImageUrl}
                    onChange={(event) => setGalleryForm({ ...galleryForm, coverImageUrl: event.target.value })}
                    className="w-full rounded border border-border bg-card px-3 py-2 text-foreground"
                  />
                </label>

                {galleryForm.coverImageUrl && (
                  <div className="mt-3 h-44 max-w-md overflow-hidden rounded border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={galleryForm.coverImageUrl} alt="Prévia da capa" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveGallery}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar galeria"}
                  </button>
                </div>

                {selectedGallery && (
                  <div className="mt-8 border-t border-border pt-5">
                    <div className="mb-4 flex items-center gap-2">
                      <ImagePlus className="h-5 w-5 text-blue-400" />
                      <h3 className="text-base font-semibold">Imagens da galeria</h3>
                    </div>

                    <div className="mb-5 rounded border border-border bg-card p-3">
                      <h4 className="mb-3 text-sm font-medium">Adicionar imagem</h4>
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                        <input
                          placeholder="URL Cloudinary ou caminho interno"
                          value={imageDraft.imageUrl}
                          onChange={(event) => setImageDraft({ ...imageDraft, imageUrl: event.target.value })}
                          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <input
                          placeholder="Legenda"
                          value={imageDraft.caption}
                          onChange={(event) => setImageDraft({ ...imageDraft, caption: event.target.value })}
                          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <input
                          type="number"
                          placeholder="Ordem"
                          value={imageDraft.sortOrder}
                          onChange={(event) => setImageDraft({ ...imageDraft, sortOrder: event.target.value })}
                          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <button
                          type="button"
                          onClick={handleAddImage}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-medium text-foreground hover:bg-green-600 disabled:opacity-60"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {images.length === 0 && (
                        <div className="rounded border border-border py-8 text-center text-sm text-muted-foreground/80">
                          Nenhuma imagem cadastrada nesta galeria.
                        </div>
                      )}
                      {images.map((image) => {
                        const form = editingImages[image.id] ?? toImageForm(image)
                        return (
                          <div key={image.id} className="grid gap-3 rounded border border-border bg-card p-3 md:grid-cols-[160px_1fr_auto]">
                            <div className="h-28 overflow-hidden rounded bg-secondary">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={form.imageUrl} alt={form.caption || "Imagem da galeria"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            </div>
                            <div className="grid gap-2">
                              <input
                                value={form.imageUrl}
                                onChange={(event) =>
                                  setEditingImages({
                                    ...editingImages,
                                    [image.id]: { ...form, imageUrl: event.target.value },
                                  })
                                }
                                className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                              />
                              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                                <input
                                  placeholder="Legenda"
                                  value={form.caption}
                                  onChange={(event) =>
                                    setEditingImages({
                                      ...editingImages,
                                      [image.id]: { ...form, caption: event.target.value },
                                    })
                                  }
                                  className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                                <input
                                  type="number"
                                  value={form.sortOrder}
                                  onChange={(event) =>
                                    setEditingImages({
                                      ...editingImages,
                                      [image.id]: { ...form, sortOrder: event.target.value },
                                    })
                                  }
                                  className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 md:flex-col">
                              <button
                                type="button"
                                onClick={() => handleSaveImage(image.id)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-foreground hover:bg-blue-700 disabled:opacity-60"
                              >
                                <Check className="h-4 w-4" />
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setGalleryForm({ ...galleryForm, coverImageUrl: form.imageUrl })}
                                className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground/90 hover:bg-secondary"
                              >
                                Usar capa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(image)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-100 hover:bg-red-900 disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

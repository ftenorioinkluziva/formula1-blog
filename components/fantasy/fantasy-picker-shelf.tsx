"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Loader2, Check, ChevronLeft, ChevronRight, UserRoundX } from "lucide-react"
import { formatFantasyCurrency } from "@/components/fantasy/fantasy-ui-utils"
import type { FantasyAssetListItem, FantasySlotType } from "@/lib/fantasy/types"

// ---------------------------------------------------------------------------
// Shared carousel wrapper
// ---------------------------------------------------------------------------

function CarouselTrack({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener("scroll", updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState])

  function scroll(dir: "left" | "right") {
    const el = trackRef.current
    if (!el) return
    const step = el.clientWidth * 0.75
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" })
  }

  return (
    <div className="relative group/carousel">
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-5 w-10 bg-linear-to-r from-zinc-950 to-transparent" />
      )}

      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-300 transition-opacity hover:bg-zinc-800 hover:text-white -translate-x-3 shadow-lg
          ${canScrollLeft ? "opacity-100 sm:opacity-0 sm:group-hover/carousel:opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>

      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-300 transition-opacity hover:bg-zinc-800 hover:text-white translate-x-3 shadow-lg
          ${canScrollRight ? "opacity-100 sm:opacity-0 sm:group-hover/carousel:opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-5 w-10 bg-linear-to-l from-zinc-950 to-transparent" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Driver carousel
// ---------------------------------------------------------------------------

interface DriverShelfProps {
  items: FantasyAssetListItem[]
  busy: string | null
  selectedDriver1: number | null
  selectedDriver2: number | null
  budgetRemaining: number
  onSelect: (slot: FantasySlotType, assetId: number) => Promise<void>
}

export function DriverPickerShelf({ items, busy, selectedDriver1, selectedDriver2, budgetRemaining, onSelect }: DriverShelfProps) {
  return (
    <CarouselTrack>
      {items.map((item) => {
        const slot1 = selectedDriver1 === item.assetId
        const slot2 = selectedDriver2 === item.assetId
        const selected = slot1 || slot2
        const overBudget = !selected && item.price > budgetRemaining
        const disabled = item.isDisabled || busy !== null || overBudget
        const teamColor = item.teamColor ?? "#ef4444"

        return (
          <div
            key={item.assetId}
            className={`group relative flex-none w-30 rounded-xl border bg-zinc-950/80 overflow-hidden transition-colors duration-150 cursor-pointer select-none
              ${selected
                ? "border-red-500/60 bg-red-500/5"
                : disabled
                  ? "border-zinc-800/50 opacity-50 cursor-not-allowed"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            data-testid={`fantasy-driver-card-${item.assetId}`}
          >
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: teamColor }} />

            <div className="relative h-28 overflow-hidden bg-zinc-900/60">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="120px"
                  className="object-cover object-top"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl font-black text-zinc-700">
                  #{item.number ?? "-"}
                </div>
              )}
              <div className="absolute inset-0 bg-zinc-950/35" />
              <div className="absolute bottom-1.5 left-2 text-xs font-black text-white/70">#{item.number}</div>
              {selected && (
                <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="p-2">
              <div className="truncate text-[11px] font-semibold text-zinc-100 leading-tight">
                {item.shortName ?? item.name.split(" ").pop()}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-500">{item.teamName}</div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-zinc-300">${formatFantasyCurrency(item.price)}</span>
                {slot1 && <span className="text-[9px] font-bold uppercase tracking-wide text-red-400">D1</span>}
                {slot2 && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400">D2</span>}
              </div>
            </div>

            {!disabled && !selected && (
              <>
                <div className="absolute inset-0 hidden sm:grid sm:grid-rows-2">
                  <button
                    className="relative group/d1"
                    onClick={() => void onSelect("driver_1", item.assetId)}
                    disabled={busy !== null}
                    data-testid={`fantasy-select-driver-1-${item.assetId}`}
                    aria-label={`Select ${item.name} as Driver 1`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/d1:opacity-100 bg-black/40 transition-opacity text-[10px] font-bold uppercase tracking-wider text-red-300">
                      {busy === "driver_1" ? <Loader2 className="h-3 w-3 animate-spin" /> : "D1"}
                    </span>
                  </button>
                  <button
                    className="relative group/d2"
                    onClick={() => void onSelect("driver_2", item.assetId)}
                    disabled={busy !== null}
                    data-testid={`fantasy-select-driver-2-${item.assetId}`}
                    aria-label={`Select ${item.name} as Driver 2`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/d2:opacity-100 bg-black/40 transition-opacity text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {busy === "driver_2" ? <Loader2 className="h-3 w-3 animate-spin" /> : "D2"}
                    </span>
                  </button>
                </div>
                <div className="sm:hidden flex border-t border-zinc-800">
                  <button
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors active:bg-red-500/20"
                    onClick={() => void onSelect("driver_1", item.assetId)}
                    disabled={busy !== null}
                    data-testid={`fantasy-select-driver-1-mobile-${item.assetId}`}
                  >
                    {busy === "driver_1" ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "D1"}
                  </button>
                  <div className="w-px bg-zinc-800" />
                  <button
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 transition-colors active:bg-amber-500/20"
                    onClick={() => void onSelect("driver_2", item.assetId)}
                    disabled={busy !== null}
                    data-testid={`fantasy-select-driver-2-mobile-${item.assetId}`}
                  >
                    {busy === "driver_2" ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "D2"}
                  </button>
                </div>
              </>
            )}
            {!disabled && selected && (
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
                onClick={() => {
                  if (slot1) void onSelect("driver_1", item.assetId)
                  else void onSelect("driver_2", item.assetId)
                }}
                disabled={busy !== null}
                aria-label={`Deselect ${item.name}`}
              />
            )}
          </div>
        )
      })}
    </CarouselTrack>
  )
}

// ---------------------------------------------------------------------------
// Team carousel
// ---------------------------------------------------------------------------

interface TeamShelfProps {
  items: FantasyAssetListItem[]
  busy: string | null
  selectedTeam: number | null
  budgetRemaining: number
  onSelect: (slot: FantasySlotType, assetId: number) => Promise<void>
}

export function TeamPickerShelf({ items, busy, selectedTeam, budgetRemaining, onSelect }: TeamShelfProps) {
  return (
    <CarouselTrack>
      {items.map((item) => {
        const selected = selectedTeam === item.assetId
        const overBudget = !selected && item.price > budgetRemaining
        const teamColor = item.teamColor ?? "#ef4444"

        return (
          <button
            key={item.assetId}
            onClick={() => void onSelect("team", item.assetId)}
            disabled={busy !== null || overBudget}
            data-testid={`fantasy-select-team-${item.assetId}`}
            className={`group relative flex-none w-37 rounded-xl border bg-zinc-950/80 overflow-hidden text-left transition-colors duration-150 select-none
              ${selected
                ? "border-red-500/60 bg-red-500/5 cursor-pointer"
                : overBudget
                  ? "border-zinc-800/50 opacity-50 cursor-not-allowed"
                  : "border-zinc-800 hover:border-zinc-600 cursor-pointer"
              }`}
          >
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: teamColor }} />

            <div className="relative h-20 overflow-hidden bg-zinc-900/40">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="148px"
                  className="object-contain object-center py-1 px-2"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-2xl font-black text-zinc-700"
                  style={{ backgroundColor: `${teamColor}12` }}
                >
                  P{item.currentPosition ?? "-"}
                </div>
              )}
              <div className="absolute inset-0 bg-zinc-950/25" />
              {selected && (
                <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="p-2">
              <div className="truncate text-[11px] font-semibold text-zinc-100">{item.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">${formatFantasyCurrency(item.price)}</span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border"
                  style={{ color: teamColor, borderColor: `${teamColor}40`, background: `${teamColor}12` }}
                >
                  {item.profileTag ?? "team"}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </CarouselTrack>
  )
}

// ---------------------------------------------------------------------------
// Engineer carousel
// ---------------------------------------------------------------------------

interface EngineerShelfProps {
  items: FantasyAssetListItem[]
  busy: string | null
  selectedEngineer: number | null
  budgetRemaining: number
  onSelect: (slot: FantasySlotType, assetId: number) => Promise<void>
}

export function EngineerPickerShelf({ items, busy, selectedEngineer, budgetRemaining, onSelect }: EngineerShelfProps) {
  const t = useTranslations("fantasy.empty")
  return (
    <CarouselTrack>
      {items.length === 0 && (
        <div className="flex items-center gap-2 py-3" data-testid="fantasy-engineers-empty">
          <UserRoundX className="h-5 w-5 text-zinc-600" />
          <span className="text-sm text-zinc-500">{t("noPitWallLeads")}</span>
        </div>
      )}
      {items.map((item) => {
        const selected = selectedEngineer === item.assetId
        const overBudget = !selected && item.price > budgetRemaining
        const teamColor = item.teamColor ?? "#ef4444"

        return (
          <button
            key={item.assetId}
            onClick={() => void onSelect("engineer", item.assetId)}
            disabled={busy !== null || overBudget}
            data-testid={`fantasy-select-engineer-${item.assetId}`}
            className={`group relative flex-none w-33 rounded-xl border bg-zinc-950/80 overflow-hidden text-left transition-colors duration-150 select-none
              ${selected
                ? "border-red-500/60 bg-red-500/5 cursor-pointer"
                : overBudget
                  ? "border-zinc-800/50 opacity-50 cursor-not-allowed"
                  : "border-zinc-800 hover:border-zinc-600 cursor-pointer"
              }`}
          >
            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: teamColor }} />

            <div className="relative flex items-center justify-center h-16 overflow-hidden">
              <div
                className="h-12 w-12 rounded-lg border border-zinc-700"
                style={{ backgroundColor: `${teamColor}33` }}
              />
              {selected && (
                <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="p-2">
              <div className="truncate text-[11px] font-semibold text-zinc-100 leading-tight">{item.name}</div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-500">{item.teamName}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">${formatFantasyCurrency(item.price)}</span>
                {busy === "engineer" && selected && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
              </div>
            </div>
          </button>
        )
      })}
    </CarouselTrack>
  )
}

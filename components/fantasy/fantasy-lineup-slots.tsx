"use client"

import Image from "next/image"
import { UserRound } from "lucide-react"
import { formatFantasyCurrency } from "@/components/fantasy/fantasy-ui-utils"
import type { FantasyReviewResponse } from "@/lib/fantasy/types"

interface Props {
  review: FantasyReviewResponse | null
  driverImageMap: Record<number, string | null | undefined>
  teamImageMap: Record<number, string | null | undefined>
}

export function FantasyLineupSlots({ review, driverImageMap, teamImageMap }: Props) {
  const d1 = review?.lineup.driver1 ?? null
  const d2 = review?.lineup.driver2 ?? null
  const team = review?.lineup.team ?? null
  const engineer = review?.lineup.engineer ?? null

  const slots: Array<{
    label: string
    item: typeof d1 | typeof team | typeof engineer
    imageUrl?: string | null
    accentColor?: string
    isTeam?: boolean
    isCar?: boolean
  }> = [
    { label: "Driver 1", item: d1, imageUrl: d1 ? driverImageMap[d1.assetId] : null, accentColor: d1?.teamColor ?? undefined },
    { label: "Driver 2", item: d2, imageUrl: d2 ? driverImageMap[d2.assetId] : null, accentColor: d2?.teamColor ?? undefined },
    { label: "Team", item: team, imageUrl: team ? teamImageMap[team.assetId] : null, accentColor: team?.teamColor ?? undefined, isCar: true },
    { label: "Pit Wall", item: engineer, accentColor: engineer?.teamColor ?? undefined },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="fantasy-lineup-slots">
      {slots.map(({ label, item, imageUrl, accentColor, isCar }) => {
        const filled = item !== null
        const color = accentColor ?? "#3f3f46"

        return (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border transition-colors duration-150
              ${filled ? "border-zinc-700 bg-zinc-950/80" : "border-zinc-800 border-dashed bg-zinc-950/50"}`}
          >
            {/* Color accent stripe */}
            {filled && <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} />}

            {/* Image area */}
            <div className={`relative overflow-hidden ${isCar ? "h-14 sm:h-16" : "h-20 sm:h-24"}`}>
              {filled && imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={item?.name ?? label}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className={`transition-all duration-300
                    ${isCar ? "object-contain object-center py-1 px-2" : "object-cover object-top"}`}
                />
              ) : filled && !imageUrl ? (
                /* Engineer / no-image fallback */
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundColor: `${color}12` }}
                >
                  <div
                    className="h-10 w-10 rounded-lg border border-zinc-700"
                    style={{ backgroundColor: `${color}33` }}
                  />
                </div>
              ) : (
                /* Empty slot */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <UserRound className="h-6 w-6 text-zinc-700" />
                </div>
              )}
              {/* Gradient overlay for driver images */}
              {filled && imageUrl && !isCar && (
                <div className="absolute inset-0 bg-zinc-950/30" />
              )}
            </div>

            {/* Info */}
            <div className="p-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</div>
              {filled ? (
                <>
                  <div className="mt-0.5 truncate text-[11px] font-semibold text-zinc-100 leading-tight">
                    {item?.name?.split(" ").pop() ?? item?.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">${formatFantasyCurrency(item?.price ?? 0)}</div>
                </>
              ) : (
                <div className="mt-0.5 text-[10px] text-zinc-600">Empty slot</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

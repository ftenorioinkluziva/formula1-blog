"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import { ChevronRight, Trophy, Target, Star, Flag } from "lucide-react"
import { DriverDetailModal } from "@/components/driver-detail-modal"
import type { Driver } from "@/components/driver-detail-modal"
import { getNationalityFlag, getNationalityFlagImageUrl } from "@/lib/nationality-flags"
import { useLocale } from "next-intl"

interface DriversApiResponse {
    drivers: Driver[]
}

export function DriverProfiles() {
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
    const [drivers, setDrivers] = useState<Driver[]>([])
  const locale = useLocale()

    useEffect(() => {
        async function loadDrivers() {
            try {
                const response = await fetch(`/${locale}/api/drivers`, { cache: "no-store" })

                if (!response.ok) {
                    setDrivers([])
                    return
                }

                const data = (await response.json()) as DriversApiResponse
                setDrivers(data.drivers)
            } catch {
                setDrivers([])
            }
        }

        loadDrivers()
    }, [locale])

    return (
        <section id="drivers" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="drivers-heading">
            <div className="max-w-7xl mx-auto">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-12">
                    <div>
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
                            Driver Standings 2025
                        </span>
                        <h2
                            id="drivers-heading"
                            className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
                        >
                            The Drivers
                        </h2>
                    </div>
                    <a
                        href="#"
                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                    >
                        Full Standings
                        <ChevronRight className="w-4 h-4" />
                    </a>
                </div>
                {/* Drivers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {drivers.map((driver) => {
                        const nationalityFlag = getNationalityFlag(driver.nationality, driver.flag)
                        const nationalityFlagImageUrl = getNationalityFlagImageUrl(driver.nationality, driver.flag)

                        return (
                        <article
                            key={driver.shortName}
                            className="group relative bg-card rounded-sm overflow-hidden border border-border hover:border-foreground/20 transition-all cursor-pointer"
                            onClick={() => setSelectedDriver(driver as Driver)}
                        >
                            {/* Team color accent bar */}
                            <div
                                className="absolute top-0 left-0 w-full h-1 transition-all"
                                style={{ backgroundColor: driver.teamColor }}
                            />
                            <div className="flex flex-col sm:flex-row sm:items-stretch">
                                {/* Driver number / image area */}
                                <div className="relative w-full sm:w-36 md:w-44 shrink-0 bg-secondary overflow-hidden aspect-video sm:aspect-auto flex items-center justify-center">
                                    {driver.imageUrl ? (
                                        <>
                                            <Image
                                                src={driver.imageUrl}
                                                alt={driver.name}
                                                fill
                                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 144px, 176px"
                                                className="object-cover object-top transition-all group-hover:scale-105"
                                            />
                                            <div
                                                className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                                                style={{
                                                    background: `linear-gradient(135deg, ${driver.teamColor}60, transparent)`,
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span
                                                className="text-6xl sm:text-7xl font-black opacity-10 select-none"
                                                style={{ color: driver.teamColor }}
                                            >
                                                {driver.number}
                                            </span>
                                            <div
                                                className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                                                style={{
                                                    background: `linear-gradient(135deg, ${driver.teamColor}60, transparent)`,
                                                }}
                                            />
                                        </>
                                    )}
                                    {/* Position badge */}
                                    <div className="absolute top-3 left-3 flex items-center justify-center w-8 h-8 bg-background/80 backdrop-blur-sm rounded-sm">
                                        <span className="text-sm font-black text-foreground">{driver.position}</span>
                                    </div>
                                    {/* Driver number badge */}
                                    <div
                                        className="absolute top-12 left-3 px-2 py-0.5 rounded-sm"
                                        style={{ backgroundColor: driver.teamColor + "22", border: `1px solid ${driver.teamColor}44` }}
                                    >
                                        <span className="text-xs font-black" style={{ color: driver.teamColor }}>
                                            #{driver.number}
                                        </span>
                                    </div>
                                    {/* Mobile points overlay */}
                                    <div className="absolute bottom-3 right-3 sm:hidden px-2.5 py-1 bg-background/80 backdrop-blur-sm rounded-sm">
                                        <span className="text-base font-black" style={{ color: driver.teamColor }}>
                                            {driver.points}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground ml-1">PTS</span>
                                    </div>
                                </div>
                                {/* Driver info */}
                                <div className="flex-1 p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground mb-0.5 group-hover:text-primary transition-colors">
                                                    {driver.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                                                        {nationalityFlagImageUrl ? (
                                                            <img
                                                                src={nationalityFlagImageUrl}
                                                                alt={`${driver.nationality} flag`}
                                                                className="inline-block h-3 w-[18px] object-cover rounded-[2px] align-[-1px] mr-1"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <span className="emoji-flag mr-1">{nationalityFlag}</span>
                                                        )}
                                                        {driver.nationality}
                                                    </span>
                                                    <span className="text-border text-[10px]">·</span>
                                                    <span
                                                        className="text-[10px] sm:text-xs font-semibold"
                                                        style={{ color: driver.teamColor }}
                                                    >
                                                        {driver.team}
                                                    </span>
                                                </div>
                                            </div>
                                            {driver.championships > 0 && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 rounded-sm border border-yellow-500/20">
                                                    <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                                                    <span className="text-[10px] font-black text-yellow-500">
                                                        {driver.championships}×
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                                            {driver.pob} · {driver.dob}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 border-t border-border">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <Trophy className="w-3 h-3 text-primary" />
                                                <span className="text-[10px] sm:text-xs font-bold text-foreground">{driver.wins}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground">wins</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Target className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-[10px] sm:text-xs font-bold text-foreground">{driver.podiums}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground">podiums</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Flag className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-[10px] sm:text-xs font-bold text-foreground">{driver.poles}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground">poles</span>
                                            </div>
                                        </div>
                                        <div className="hidden sm:block text-right">
                                            <span
                                                className="text-xl font-black"
                                                style={{ color: driver.teamColor }}
                                            >
                                                {driver.points}
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-1">PTS</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Hover arrow - desktop only */}
                                <div className="hidden md:flex items-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </div>
                        </article>
                        )
                    })}
                </div>
            </div>
            <DriverDetailModal
                driver={selectedDriver}
                open={selectedDriver !== null}
                onClose={() => setSelectedDriver(null)}
            />
        </section>
    )
}

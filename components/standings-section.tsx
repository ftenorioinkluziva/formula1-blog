"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { Trophy, TrendingUp } from "lucide-react"

type DriverStanding = {
    name: string
    abbr: string
    team: string
    teamColor: string
    points: number
    wins: number
}

type ConstructorStanding = {
    name: string
    color: string
    points: number
    wins: number
}

interface DriversApiResponse {
    drivers: Array<{
        name: string
        shortName: string
        team: string
        teamColor: string
        points: number
        wins: number
    }>
}

interface TeamsApiResponse {
    teams: Array<{
        name: string
        color: string
        points: number
        wins: number
    }>
}

const medalColors: Record<number, string> = {
    0: "text-yellow-400",
    1: "text-slate-400",
    2: "text-amber-600",
}

export function StandingsSection() {
    const [tab, setTab] = useState<"drivers" | "constructors">("drivers")
    const [drivers, setDrivers] = useState<DriverStanding[]>([])
    const [constructors, setConstructors] = useState<ConstructorStanding[]>([])
  const locale = useLocale()

    useEffect(() => {
        async function loadStandings() {
            try {
                const [driversResponse, constructorsResponse] = await Promise.all([
                    fetch(`/${locale}/api/drivers`, { cache: "no-store" }),
                    fetch(`/${locale}/api/teams`, { cache: "no-store" }),
                ])

                if (!driversResponse.ok || !constructorsResponse.ok) {
                    setDrivers([])
                    setConstructors([])
                    return
                }

                const driversData = (await driversResponse.json()) as DriversApiResponse
                const constructorsData = (await constructorsResponse.json()) as TeamsApiResponse

                setDrivers(
                    driversData.drivers.map((driver) => ({
                        name: driver.name,
                        abbr: driver.shortName,
                        team: driver.team,
                        teamColor: driver.teamColor,
                        points: driver.points,
                        wins: driver.wins,
                    })),
                )

                setConstructors(
                    constructorsData.teams.map((team) => ({
                        name: team.name,
                        color: team.color,
                        points: team.points,
                        wins: team.wins,
                    })),
                )
            } catch {
                setDrivers([])
                setConstructors([])
            }
        }

        loadStandings()
    }, [locale])

    return (
        <section
            id="standings"
            className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8"
            aria-labelledby="standings-heading"
        >
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-12">
                    <div>
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2 block">
                            2026 Season
                        </span>
                        <h2
                            id="standings-heading"
                            className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground"
                        >
                            Standings
                        </h2>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex items-center gap-1 p-1 bg-secondary rounded-sm border border-border">
                        <button
                            onClick={() => setTab("drivers")}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${tab === "drivers"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Drivers
                        </button>
                        <button
                            onClick={() => setTab("constructors")}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${tab === "constructors"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Constructors
                        </button>
                    </div>
                </div>

                {/* Drivers table */}
                {tab === "drivers" && (
                    <div className="flex flex-col gap-1">
                        {/* Column headers */}
                        <div className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto] gap-4 px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <span>Pos</span>
                            <span>Driver</span>
                            <span className="text-right">Wins</span>
                            <span className="text-right">Points</span>
                        </div>

                        {drivers.map((d, i) => {
                            const pos = i + 1
                            const isTop3 = pos <= 3
                            return (
                                <div
                                    key={d.abbr}
                                    className={`group grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_auto_auto] items-center gap-4 px-4 py-3 rounded-sm border transition-colors ${isTop3
                                        ? "bg-secondary/60 border-border"
                                        : "border-transparent hover:bg-secondary/40 hover:border-border"
                                        }`}
                                >
                                    {/* Position */}
                                    <span
                                        className={`text-sm font-black tabular-nums ${medalColors[i] ?? "text-muted-foreground"
                                            }`}
                                    >
                                        {pos}
                                    </span>

                                    {/* Driver info */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className="w-1 h-5 rounded-full shrink-0"
                                            style={{ backgroundColor: d.teamColor }}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-foreground leading-tight truncate">
                                                {d.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{d.team}</p>
                                        </div>
                                        {isTop3 && (
                                            <Trophy className={`w-3.5 h-3.5 shrink-0 ${medalColors[i]}`} />
                                        )}
                                    </div>

                                    {/* Wins — hidden on xs */}
                                    <span className="hidden sm:block text-xs text-muted-foreground text-right tabular-nums">
                                        {d.wins > 0 ? (
                                            <span className="flex items-center gap-1 justify-end">
                                                <TrendingUp className="w-3 h-3 text-primary" />
                                                {d.wins}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </span>

                                    {/* Points */}
                                    <span className="text-sm font-black text-foreground text-right tabular-nums">
                                        {d.points}
                                        <span className="text-[10px] font-normal text-muted-foreground ml-1">PTS</span>
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Constructors table */}
                {tab === "constructors" && (
                    <div className="flex flex-col gap-1">
                        {/* Column headers */}
                        <div className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto] gap-4 px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <span>Pos</span>
                            <span>Constructor</span>
                            <span className="text-right">Wins</span>
                            <span className="text-right">Points</span>
                        </div>

                        {constructors.map((c, i) => {
                            const pos = i + 1
                            const isTop3 = pos <= 3
                            return (
                                <div
                                    key={c.name}
                                    className={`group grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_auto_auto] items-center gap-4 px-4 py-3 rounded-sm border transition-colors ${isTop3
                                        ? "bg-secondary/60 border-border"
                                        : "border-transparent hover:bg-secondary/40 hover:border-border"
                                        }`}
                                >
                                    {/* Position */}
                                    <span
                                        className={`text-sm font-black tabular-nums ${medalColors[i] ?? "text-muted-foreground"
                                            }`}
                                    >
                                        {pos}
                                    </span>

                                    {/* Constructor info */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className="w-1 h-5 rounded-full shrink-0"
                                            style={{ backgroundColor: c.color }}
                                        />
                                        <p className="text-sm font-black text-foreground leading-tight truncate">
                                            {c.name}
                                        </p>
                                        {isTop3 && (
                                            <Trophy className={`w-3.5 h-3.5 shrink-0 ${medalColors[i]}`} />
                                        )}
                                    </div>

                                    {/* Wins */}
                                    <span className="hidden sm:block text-xs text-muted-foreground text-right tabular-nums">
                                        {c.wins > 0 ? (
                                            <span className="flex items-center gap-1 justify-end">
                                                <TrendingUp className="w-3 h-3 text-primary" />
                                                {c.wins}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </span>

                                    {/* Points */}
                                    <span className="text-sm font-black text-foreground text-right tabular-nums">
                                        {c.points}
                                        <span className="text-[10px] font-normal text-muted-foreground ml-1">PTS</span>
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}

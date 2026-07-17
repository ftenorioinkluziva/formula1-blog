"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import {
    Trophy,
    Target,
    Flag,
    Star,
    X,
    User,
    MapPin,
    Calendar,
    Hash,
    Activity,
    TrendingUp,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import { getNationalityFlag, getNationalityFlagImageUrl } from "@/lib/nationality-flags"

type DriverProfile = {
    name: string
    shortName: string
    number: number
    team: string
    teamColor: string
    nationality: string
    flag: string
    points: number
    position: number
    wins: number
    podiums: number
    poles: number
    championships: number
    dob: string
    pob: string
}

export type Driver = DriverProfile & {
    gpEntered: number
    careerPoints: string
    bestFinish: string
    bestGrid: string
    dnfs: number
    imageUrl: string | null
}
interface DriverDetailModalProps {
    driver: Driver | null
    open: boolean
    onClose: () => void
}
function DriverDetailContent({ driver }: { driver: Driver }) {
    const isChampion = driver.championships > 0
    const nationalityFlag = getNationalityFlag(driver.nationality, driver.flag)
    const nationalityFlagImageUrl = getNationalityFlagImageUrl(driver.nationality, driver.flag)

    return (
        <div className="flex flex-col gap-6 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div
                    className="relative flex items-center justify-center w-16 h-16 rounded-sm shrink-0"
                    style={{
                        backgroundColor: driver.teamColor + "15",
                        border: `1px solid ${driver.teamColor}40`,
                    }}
                >
                    <span
                        className="text-3xl font-black leading-none"
                        style={{ color: driver.teamColor }}
                    >
                        {driver.number}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground leading-tight">
                        {driver.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                            {nationalityFlagImageUrl ? (
                                <Image
                                    src={nationalityFlagImageUrl}
                                    alt={`${driver.nationality} flag`}
                                    width={20}
                                    height={14}
                                    className="inline-block h-3.5 w-5.5 object-cover rounded-[2px] align-[-1px] mr-1"
                                />
                            ) : (
                                <span className="emoji-flag mr-1">{nationalityFlag}</span>
                            )}
                            {driver.nationality}
                        </span>
                        <span className="text-border text-xs">·</span>
                        <span
                            className="text-xs font-semibold"
                            style={{ color: driver.teamColor }}
                        >
                            {driver.team}
                        </span>
                    </div>
                </div>
                {isChampion && (
                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
                        <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                        <span className="text-xs font-black text-yellow-500">
                            {driver.championships}×
                        </span>
                    </div>
                )}
            </div>
            {/* Team color bar */}
            <div
                className="h-1 w-full rounded-full"
                style={{ backgroundColor: driver.teamColor }}
            />
            {/* 2025 Season stats grid */}
            <div className="grid grid-cols-4 gap-2">
                <div
                    className="flex flex-col items-center justify-center p-3 rounded-sm border"
                    style={{
                        backgroundColor: driver.teamColor + "08",
                        borderColor: driver.teamColor + "30",
                    }}
                >
                    <span className="text-xl font-black" style={{ color: driver.teamColor }}>
                        {driver.points}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        PTS
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-sm bg-secondary/60 border border-border">
                    <span className="text-xl font-black text-foreground">{driver.wins}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Wins
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-sm bg-secondary/60 border border-border">
                    <span className="text-xl font-black text-foreground">{driver.podiums}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Podiums
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-sm bg-secondary/60 border border-border">
                    <span className="text-xl font-black text-foreground">{driver.poles}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Poles
                    </span>
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Personal info */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Personal Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                        <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Date of Birth
                            </p>
                            <p className="text-sm font-bold text-foreground">{driver.dob}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                        <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Place of Birth
                            </p>
                            <p className="text-sm font-bold text-foreground leading-tight">{driver.pob}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                        <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Nationality
                            </p>
                            <p className="text-sm font-bold text-foreground">
                                {nationalityFlagImageUrl ? (
                                    <Image
                                        src={nationalityFlagImageUrl}
                                        alt={`${driver.nationality} flag`}
                                        width={24}
                                        height={16}
                                        className="inline-block h-4 w-6 object-cover rounded-[2px] align-[-1px] mr-1"
                                    />
                                ) : (
                                    <span className="emoji-flag mr-1">{nationalityFlag}</span>
                                )}
                                {driver.nationality}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                        <Hash className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Car Number
                            </p>
                            <p className="text-sm font-bold text-foreground">#{driver.number}</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* 2025 Season stats list */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    2025 Season
                </p>
                <div className="flex flex-col gap-1.5">
                    {[
                        { label: "Championship Position", value: `P${driver.position}`, icon: Trophy },
                        { label: "Race Wins", value: driver.wins, icon: Trophy },
                        { label: "Podiums", value: driver.podiums, icon: Target },
                        { label: "Pole Positions", value: driver.poles, icon: Flag },
                        { label: "Points", value: driver.points, icon: Star },
                    ].map(({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="flex items-center justify-between px-3 py-2.5 rounded-sm border bg-secondary/40 border-border"
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-bold text-foreground">{label}</span>
                            </div>
                            <span className="text-xs font-black" style={{ color: driver.teamColor }}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Career stats */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Career Stats
                </p>
                <div className="flex flex-col gap-1.5">
                    {[
                        { label: "Grands Prix Entered", value: driver.gpEntered, icon: Flag },
                        { label: "Career Points", value: driver.careerPoints, icon: Star },
                        { label: "Best Race Finish", value: driver.bestFinish, icon: Trophy },
                        { label: "Best Grid Position", value: driver.bestGrid, icon: TrendingUp },
                        { label: "Pole Positions", value: driver.poles, icon: Activity },
                        { label: "DNFs", value: driver.dnfs, icon: Target },
                    ].map(({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="flex items-center justify-between px-3 py-2.5 rounded-sm border bg-secondary/40 border-border"
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-bold text-foreground">{label}</span>
                            </div>
                            <span className="text-xs font-black text-foreground">{value}</span>
                        </div>
                    ))}
                </div>
            </div>
            {/* Championships highlight */}
            {isChampion && (
                <>
                    <div className="h-px bg-border" />
                    <div className="flex items-center gap-3 p-4 rounded-sm bg-yellow-500/5 border border-yellow-500/20">
                        <Star className="w-8 h-8 text-yellow-500 shrink-0" fill="currentColor" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 mb-0.5">
                                World Champion
                            </p>
                            <p className="text-2xl font-black text-yellow-500 uppercase tracking-tight">
                                {driver.championships}× Title{driver.championships > 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
export function DriverDetailModal({ driver, open, onClose }: DriverDetailModalProps) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener("resize", check)
        return () => window.removeEventListener("resize", check)
    }, [])
    if (!driver) return null
    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
                <DrawerContent className="px-4 max-h-[90dvh] overflow-y-auto">
                    <DrawerHeader className="px-0 pt-4 pb-2">
                        <div className="flex items-center justify-between">
                            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                Driver Details
                            </DrawerTitle>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-sm hover:bg-secondary transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                    </DrawerHeader>
                    <DriverDetailContent driver={driver} />
                </DrawerContent>
            </Drawer>
        )
    }
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Driver Details
                    </DialogTitle>
                </DialogHeader>
                <DriverDetailContent driver={driver} />
            </DialogContent>
        </Dialog>
    )
}

"use client"
import { useEffect, useState } from "react"
import { formatLocalDate, formatLocalDateWithWeekday, formatLocalTime } from "@/lib/localized-date-time"
import {
    MapPin,
    Clock,
    Calendar,
    Trophy,
    Flag,
    X,
    Radio,
    Timer,
    Zap,
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
export type Race = {
    round: number
    name: string
    circuit: string
    location: string
    raceStartUtc: string
    status: string
    winner?: string
    sessions: Session[]
}
type Session = {
    session: string
    startTimeUtc: string
}
interface RaceDetailModalProps {
    race: Race | null
    locale: string
    now: Date
    open: boolean
    onClose: () => void
}
function RaceDetailContent({ race, locale, now }: { race: Race; locale: string; now: Date }) {
    const isCompleted = race.status === "completed"
    const isNext = race.status === "next"
    const schedule = race.sessions
    const isSprint = schedule.some((s) => s.session === "Sprint")
    const raceDate = formatLocalDate(race.raceStartUtc, locale)
    const raceTime = formatLocalTime(race.raceStartUtc, locale)
    const nowMs = now.getTime()
    const sortedSchedule = [...schedule].sort(
        (a, b) => new Date(a.startTimeUtc).getTime() - new Date(b.startTimeUtc).getTime()
    )
    const nextSession = sortedSchedule.find((item) => new Date(item.startTimeUtc).getTime() >= nowMs)
    const nextSessionKey = nextSession ? `${nextSession.session}-${nextSession.startTimeUtc}` : null
    return (
        <div className="flex flex-col gap-6 pb-6">
            {/* Top accent + round badge */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-sm bg-primary/10 border border-primary/20">
                    <span className="text-lg font-black text-primary">
                        R{String(race.round).padStart(2, "0")}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground leading-tight">
                            {race.name}
                        </h3>
                        {isSprint && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-bold uppercase tracking-widest text-yellow-500 rounded-sm shrink-0">
                                <Zap className="w-2.5 h-2.5" />
                                Sprint
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{race.circuit}</p>
                </div>
                {isNext && (
                    <span className="shrink-0 px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm animate-pulse">
                        Next Race
                    </span>
                )}
                {isCompleted && race.winner && (
                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-xs font-black text-yellow-500">{race.winner}</span>
                    </div>
                )}
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Location
                        </p>
                        <p className="text-sm font-bold text-foreground leading-tight">
                            {race.location}
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Race Date
                        </p>
                        <p className="text-sm font-bold text-foreground">{raceDate}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Race Start
                        </p>
                        <p className="text-sm font-bold text-foreground">{raceTime}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Flag className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Circuit
                        </p>
                        <p className="text-sm font-bold text-foreground leading-tight">
                            {race.circuit}
                        </p>
                    </div>
                </div>
            </div>
            {/* Weekend schedule */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Weekend Schedule
                </p>
                <div className="flex flex-col gap-1.5">
                    {schedule.map((item) => {
                        const isRace = item.session === "Race"
                        const isQualifying = item.session === "Qualifying"
                        const isSprintSession = item.session === "Sprint"
                        const isSprintQualifying = item.session === "Sprint Qualifying"
                        const isNextEvent = nextSessionKey === `${item.session}-${item.startTimeUtc}`
                        const isPastSession = new Date(item.startTimeUtc).getTime() < nowMs && !isNextEvent
                        const sessionDay = formatLocalDateWithWeekday(item.startTimeUtc, locale)
                        const sessionTime = formatLocalTime(item.startTimeUtc, locale)
                        return (
                            <div
                                key={item.session}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-sm border transition-colors ${isNextEvent
                                    ? "bg-primary/10 border-primary/50"
                                    : isPastSession
                                        ? "bg-muted/20 border-border/60 opacity-75"
                                        : isRace
                                            ? "bg-primary/5 border-primary/30"
                                        : isSprintSession
                                            ? "bg-yellow-500/5 border-yellow-500/20"
                                            : "bg-secondary/40 border-border"
                                    }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {isNextEvent ? (
                                        <Radio className="w-3.5 h-3.5 text-primary" />
                                    ) : isPastSession ? (
                                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                                        </div>
                                    ) : isRace ? (
                                        <Radio className="w-3.5 h-3.5 text-primary" />
                                    ) : isSprintSession ? (
                                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                    ) : isQualifying || isSprintQualifying ? (
                                        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                                    ) : (
                                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div>
                                        <span
                                            className={`text-xs font-bold ${isNextEvent
                                                    ? "text-primary"
                                                    : isPastSession
                                                        ? "text-muted-foreground"
                                                    : isRace
                                                    ? "text-primary"
                                                    : isSprintSession
                                                        ? "text-yellow-500"
                                                        : "text-foreground"
                                                }`}
                                        >
                                            {item.session}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            {sessionDay}
                                        </span>
                                        {isNextEvent ? (
                                            <span className="ml-2 inline-flex items-center rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                                Next Event
                                            </span>
                                        ) : isPastSession ? (
                                            <span className="ml-2 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Done
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">
                                    {sessionTime}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
            {/* Completed race result */}
            {isCompleted && race.winner && (
                <>
                    <div className="h-px bg-border" />
                    <div className="flex items-center gap-3 p-4 rounded-sm bg-yellow-500/5 border border-yellow-500/20">
                        <Trophy className="w-8 h-8 text-yellow-500 shrink-0" />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 mb-0.5">
                                Race Winner
                            </p>
                            <p className="text-2xl font-black text-yellow-500 uppercase tracking-tight">
                                {race.winner}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
export function RaceDetailModal({ race, locale, now, open, onClose }: RaceDetailModalProps) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener("resize", check)
        return () => window.removeEventListener("resize", check)
    }, [])
    if (!race) return null
    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
                <DrawerContent className="flex flex-col max-h-[92dvh]">
                    <div className="flex-1 overflow-y-auto px-4 pb-8">
                    <DrawerHeader className="px-0 pt-4 pb-2">
                        <div className="flex items-center justify-between">
                            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                Race Details
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
                    <RaceDetailContent race={race} locale={locale} now={now} />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Race Details
                    </DialogTitle>
                </DialogHeader>
                <RaceDetailContent race={race} locale={locale} now={now} />
            </DialogContent>
        </Dialog>
    )
}
"use client"
import { useEffect, useState } from "react"
import {
    MapPin,
    Trophy,
    TrendingUp,
    Users,
    X,
    Flag,
    Target,
    Cpu,
    User,
    Wrench,
    CalendarDays,
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
export type Team = {
    name: string
    color: string
    points: number
    position: number
    driver1: string
    driver2: string
    wins: number
    podiums: number
    base: string
    fullName: string
    teamChief: string
    technicalChief: string
    chassis: string
    powerUnit: string
    firstEntry: string
    championships: number
}
interface TeamDetailModalProps {
    team: Team | null
    open: boolean
    onClose: () => void
}
function TeamDetailContent({ team }: { team: Team }) {
    const isLeader = team.position === 1
    const championships = team.championships
    return (
        <div className="flex flex-col gap-6 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center w-12 h-12 rounded-sm border"
                    style={{
                        backgroundColor: team.color + "15",
                        borderColor: team.color + "40",
                    }}
                >
                    <span className="text-lg font-black" style={{ color: team.color }}>
                        P{team.position || "–"}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground leading-tight">
                        {team.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {team.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {team.base}
                    </p>
                </div>
                {isLeader && (
                    <span className="shrink-0 px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm">
                        Leader
                    </span>
                )}
            </div>
            {/* Team color bar */}
            <div className="h-1 w-full rounded-full" style={{ backgroundColor: team.color }} />
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
                <div
                    className="flex flex-col items-center justify-center p-4 rounded-sm border"
                    style={{ backgroundColor: team.color + "08", borderColor: team.color + "30" }}
                >
                    <span className="text-2xl font-black" style={{ color: team.color }}>
                        {team.points}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Points
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 rounded-sm bg-secondary/60 border border-border">
                    <span className="text-2xl font-black text-foreground">{team.wins}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Wins
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 rounded-sm bg-secondary/60 border border-border">
                    <span className="text-2xl font-black text-foreground">{team.podiums}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                        Podiums
                    </span>
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Drivers */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    2026 Drivers
                </p>
                <div className="flex flex-col gap-2">
                    {[team.driver1, team.driver2].map((driver, i) => (
                        <div
                            key={driver}
                            className="flex items-center gap-3 px-4 py-3 rounded-sm border bg-secondary/40 border-border"
                        >
                            <div
                                className="w-8 h-8 flex items-center justify-center rounded-sm text-xs font-black"
                                style={{
                                    backgroundColor: team.color + "20",
                                    color: team.color,
                                    border: `1px solid ${team.color}40`,
                                }}
                            >
                                {i + 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm font-bold text-foreground">{driver}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Trophy className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Race Wins
                        </p>
                        <p className="text-sm font-bold text-foreground">{team.wins}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Podiums
                        </p>
                        <p className="text-sm font-bold text-foreground">{team.podiums}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Championships
                        </p>
                        <p className="text-sm font-bold text-foreground">{championships}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-sm bg-secondary/60 border border-border">
                    <Flag className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Position
                        </p>
                        <p className="text-sm font-bold text-foreground">P{team.position || "–"}</p>
                    </div>
                </div>
            </div>
            {/* Divider */}
            <div className="h-px bg-border" />
            {/* Technical profile */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Team Profile
                </p>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28 shrink-0">
                            Team Chief
                        </span>
                        <span className="text-xs font-bold text-foreground">{team.teamChief}</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border">
                        <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28 shrink-0">
                            Technical Chief
                        </span>
                        <span className="text-xs font-bold text-foreground">{team.technicalChief}</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border">
                        <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28 shrink-0">
                            Chassis
                        </span>
                        <span className="text-xs font-bold text-foreground">{team.chassis}</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border">
                        <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28 shrink-0">
                            Power Unit
                        </span>
                        <span className="text-xs font-bold text-foreground">{team.powerUnit}</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-secondary/40 border border-border">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28 shrink-0">
                            First Entry
                        </span>
                        <span className="text-xs font-bold text-foreground">{team.firstEntry}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
export function TeamDetailModal({ team, open, onClose }: TeamDetailModalProps) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener("resize", check)
        return () => window.removeEventListener("resize", check)
    }, [])
    if (!team) return null
    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
                <DrawerContent className="px-4 max-h-[90dvh] overflow-y-auto">
                    <DrawerHeader className="px-0 pt-4 pb-2">
                        <div className="flex items-center justify-between">
                            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                Team Details
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
                    <TeamDetailContent team={team} />
                </DrawerContent>
            </Drawer>
        )
    }
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Team Details
                    </DialogTitle>
                </DialogHeader>
                <TeamDetailContent team={team} />
            </DialogContent>
        </Dialog>
    )
}
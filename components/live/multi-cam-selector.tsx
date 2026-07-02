"use client"

import { useState } from "react"
import { Monitor, Camera, Users, BarChart3, MapPin } from "lucide-react"

export interface CameraChannel {
  channelId: number
  type: "additional" | "obc"
  identifier: "PRES" | "WIF" | "TRACKER" | "DATA" | "OBC"
  title: string
  driverFirstName: string | null
  driverLastName: string | null
  teamName: string
  racingNumber: number
  hex: string | null
}

interface MultiCamSelectorProps {
  channels: CameraChannel[]
  activeChannelId: number | null
  onChannelSelect: (channel: CameraChannel) => void
  className?: string
}

const CHANNEL_ICONS: Record<string, typeof Monitor> = {
  WIF: Monitor,
  OBC: Camera,
  PRES: Users,
  DATA: BarChart3,
  TRACKER: MapPin,
}

const CHANNEL_LABELS: Record<string, string> = {
  WIF: "World Feed",
  PRES: "Pit Lane",
  DATA: "Data Channel",
  TRACKER: "Tracker",
}

export function MultiCamSelector({
  channels,
  activeChannelId,
  onChannelSelect,
  className = "",
}: MultiCamSelectorProps) {
  const [showDrivers, setShowDrivers] = useState(false)

  const mainChannels = channels.filter((c) => c.identifier !== "OBC")
  const driverChannels = channels.filter((c) => c.identifier === "OBC")

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex gap-1 flex-wrap">
        {mainChannels.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.identifier] ?? Monitor
          const label = CHANNEL_LABELS[channel.identifier] ?? channel.title
          const isActive = channel.channelId === activeChannelId

          return (
            <button
              key={channel.channelId}
              onClick={() => onChannelSelect(channel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}

        {driverChannels.length > 0 && (
          <button
            onClick={() => setShowDrivers(!showDrivers)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showDrivers || driverChannels.some((c) => c.channelId === activeChannelId)
                ? "bg-zinc-600 text-white"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Camera className="h-3 w-3" />
            Onboards ({driverChannels.length})
          </button>
        )}
      </div>

      {showDrivers && driverChannels.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-1 mt-1">
          {driverChannels.map((channel) => {
            const isActive = channel.channelId === activeChannelId
            const teamColor = channel.hex ? `#${channel.hex}` : "#666"

            return (
              <button
                key={channel.channelId}
                onClick={() => {
                  onChannelSelect(channel)
                  setShowDrivers(false)
                }}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? "bg-zinc-700 ring-1 ring-red-500"
                    : "bg-zinc-800/50 hover:bg-zinc-700/50"
                }`}
              >
                <span
                  className="font-bold text-sm"
                  style={{ color: teamColor }}
                >
                  {channel.racingNumber}
                </span>
                <span className="text-zinc-400 text-[10px] truncate max-w-full">
                  {channel.driverLastName?.toUpperCase().slice(0, 3) ?? channel.title}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

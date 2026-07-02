import type { Metadata } from "next"
import { WatchLiveClient } from "@/components/watch/watch-live-client"

export const metadata: Metadata = {
  title: "F1 Watch — Ao Vivo",
  description: "Engineer Board com sinal ao vivo F1TV e timing em tempo real",
}

export default function WatchLivePage() {
  return <WatchLiveClient />
}

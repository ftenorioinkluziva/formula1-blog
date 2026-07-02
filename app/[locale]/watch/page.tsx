import type { Metadata } from "next"
import { WatchPageClient } from "@/components/watch/watch-page-client"

export const metadata: Metadata = {
  title: "F1 Watch — Timing Sincronizado",
  description: "Assista corridas da F1TV com timing de voltas sincronizado em tempo real",
}

export default function WatchPage() {
  return <WatchPageClient />
}

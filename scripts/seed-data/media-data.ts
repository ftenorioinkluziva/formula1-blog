export interface MediaGallerySeedItem {
  title: string
  imageCount: number
  category: string
}

export interface GalleryImageSeedItem {
  imageUrl: string
  caption?: string
}

export interface MediaPodcastSeedItem {
  title: string
  episode: string
  duration: string
  guest: string
}

export const mediaGalleriesSeed: MediaGallerySeedItem[] = [
  { title: "Race Day Gallery: 48 Stunning Shots", imageCount: 48, category: "PHOTOS" },
  { title: "Paddock Access: Behind the Scenes", imageCount: 32, category: "PHOTOS" },
  { title: "Qualifying Action: Best of Saturday", imageCount: 24, category: "PHOTOS" },
]

export const galleryImagesSeed: Record<string, GalleryImageSeedItem[]> = {
  "Race Day Gallery: 48 Stunning Shots": [
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Race+Start", caption: "Lights out — the race begins" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Turn+1", caption: "Chaos at Turn 1" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Pit+Stop", caption: "A lightning-fast pit stop" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Safety+Car", caption: "Safety car deployed after incident" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Podium", caption: "The top three on the podium" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Celebration", caption: "Championship celebration" },
  ],
  "Paddock Access: Behind the Scenes": [
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Garage+Walk", caption: "Inside the garage" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Driver+Prep", caption: "Driver pre-race preparation" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Engineers", caption: "Engineers reviewing data" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Media+Zone", caption: "Media centre buzz" },
  ],
  "Qualifying Action: Best of Saturday": [
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Q1+Launch", caption: "Q1 flying lap" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Q2+Battle", caption: "Tight battle in Q2" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Pole+Position", caption: "Pole position celebration" },
    { imageUrl: "/placeholder.svg?height=800&width=1200&text=Grid+Boys", caption: "Cars lined up on the grid" },
  ],
}

export const mediaPodcastsSeed: MediaPodcastSeedItem[] = []


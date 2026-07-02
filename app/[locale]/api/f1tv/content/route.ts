import { NextRequest, NextResponse } from 'next/server'
import { getContentVideo, searchVod } from '@/lib/f1tv/client'
import { ensureAuthenticated } from '@/lib/f1tv/auth'

export const dynamic = 'force-dynamic'

interface RawContainer {
  id?: string
  metadata?: {
    contentId?: number
    title?: string
    titleBrief?: string
    duration?: number
    season?: number
    pictureUrl?: string
    objectType?: string
    contentSubtype?: string
    isOnAir?: boolean
    emfAttributes?: {
      Meeting_Name?: string
      Circuit_Short_Name?: string
      state?: string
      [key: string]: unknown
    }
    additionalStreams?: {
      channelId: number
      type: string
      identifier: string
      title: string
      driverFirstName?: string
      driverLastName?: string
      teamName: string
      racingNumber: number
      hex?: string
    }[]
    [key: string]: unknown
  }
  actions?: { key: string; uri: string; targetType?: string }[]
  containers?: RawContainer[] | { bundles?: unknown[] }
  [key: string]: unknown
}

function collectVideos(containers: RawContainer[]): RawContainer[] {
  const seen = new Set<number>()
  const videos: RawContainer[] = []

  function add(item: RawContainer) {
    const m = item.metadata
    if (!m?.contentId || seen.has(m.contentId)) return
    seen.add(m.contentId)
    videos.push(item)
  }

  for (const item of containers) {
    if (item.metadata?.objectType === 'VIDEO') {
      add(item)
    }
    if (Array.isArray((item as Record<string, unknown>).events)) {
      for (const event of (item as Record<string, unknown>).events as RawContainer[]) {
        if (event.metadata?.objectType === 'VIDEO') add(event)
      }
    }
  }
  return videos
}

async function fetchMeetingPage(uri: string): Promise<RawContainer[]> {
  const url = `https://f1tv.formula1.com${uri}`
  const res = await fetch(url)
  if (!res.ok) return []

  const data = await res.json()
  const sections: RawContainer[] = data.resultObj?.containers ?? []

  const candidates: RawContainer[] = []
  for (const section of sections) {
    const directItems = Array.isArray(section.containers) ? section.containers : []
    candidates.push(...directItems)

    const retrieveItems = (section as Record<string, unknown>).retrieveItems as
      { resultObj?: { containers?: RawContainer[] } } | undefined
    const retrievedItems = retrieveItems?.resultObj?.containers ?? []
    candidates.push(...retrievedItems)
  }
  return collectVideos(candidates)
}

export async function GET(request: NextRequest) {
  try {
    await ensureAuthenticated()
  } catch {
    return NextResponse.json(
      { error: 'F1TV not authenticated. Set F1TV_TOKEN in .env.local' },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const contentId = url.searchParams.get('contentId')
  const meetingUri = url.searchParams.get('meetingUri')
  const query = url.searchParams.get('q')
  const season = url.searchParams.get('season')

  try {
    if (contentId) {
      const container = await getContentVideo(Number(contentId))
      const channels = container.metadata.additionalStreams?.map((s) => ({
        channelId: s.channelId,
        type: s.type,
        identifier: s.identifier,
        title: s.title,
        driverFirstName: s.driverFirstName ?? null,
        driverLastName: s.driverLastName ?? null,
        teamName: s.teamName,
        racingNumber: s.racingNumber,
        hex: s.hex ?? null,
      })) ?? []

      return NextResponse.json({
        contentId: container.metadata.contentId,
        title: container.metadata.title,
        duration: container.metadata.duration,
        season: container.metadata.season,
        meeting: container.metadata.emfAttributes.Meeting_Name,
        circuit: container.metadata.emfAttributes.Circuit_Short_Name,
        isOnAir: container.metadata.isOnAir,
        pictureUrl: container.metadata.pictureUrl,
        sessionStartDate: (() => {
          const raw = container.metadata.emfAttributes.sessionStartDate
          if (!raw) return null
          const ms = Number(raw)
          if (!isNaN(ms) && ms > 0) return new Date(ms).toISOString()
          return String(raw)
        })(),
        channels,
      })
    }

    if (meetingUri) {
      const sessions = await fetchMeetingPage(meetingUri)
      const items = sessions
        .filter((s) => {
          if (s.metadata?.contentSubtype === 'LIVE_EVENT') return false
          if (season && s.metadata?.season && String(s.metadata.season) !== season) return false
          return true
        })
        .map((s) => {
          const m = s.metadata!
          return {
            contentId: m.contentId,
            title: m.title ?? m.titleBrief ?? '',
            duration: m.duration ?? 0,
            contentSubtype: m.contentSubtype ?? '',
            pictureUrl: m.pictureUrl ?? null,
            isOnAir: m.isOnAir ?? false,
          }
        })
      return NextResponse.json(items)
    }

    const result = await searchVod({
      ...(season && { filter_season: season }),
      maxResults: '30',
      orderBy: 'meeting_Number',
      sortOrder: 'desc',
    })

    const containers = (result.resultObj.containers ?? []) as RawContainer[]

    let meetings = containers
      .filter((c) => c.metadata?.contentId)
      .map((c) => {
        const m = c.metadata!
        const detailAction = (c.actions ?? []).find((a) => a.key === 'onClick')
        return {
          contentId: m.contentId,
          title: m.title ?? '',
          season: m.season ?? 0,
          meeting: m.emfAttributes?.Meeting_Name ?? '',
          circuit: m.emfAttributes?.Circuit_Short_Name ?? '',
          pictureUrl: m.pictureUrl ?? null,
          detailUri: detailAction?.uri ?? null,
        }
      })

    if (query) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean)
      meetings = meetings.filter((item) => {
        const haystack = [item.title, item.meeting, item.circuit]
          .join(' ')
          .toLowerCase()
        return words.every((w) => haystack.includes(w))
      })
    }

    if (season) {
      const checks = await Promise.all(
        meetings.map(async (m) => {
          if (!m.detailUri) return false
          const sessions = await fetchMeetingPage(m.detailUri)
          return sessions.some((s) =>
            s.metadata?.contentSubtype !== 'LIVE_EVENT' &&
            (!s.metadata?.season || String(s.metadata.season) === season)
          )
        })
      )
      meetings = meetings.filter((_, i) => checks[i])
    }

    return NextResponse.json(meetings)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[f1tv/content]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

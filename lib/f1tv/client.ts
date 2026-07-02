import { ensureAuthenticated } from './auth'
import type {
  F1TVApiResult,
  F1TVConfig,
  F1TVContentPlayResult,
  F1TVContentVideoContainer,
  F1TVContentVideoResult,
  F1TVEntitlementResult,
  F1TVLanguage,
  F1TVLiveNowResult,
  F1TVLocationResult,
  F1TVPlatform,
  F1TVSearchVodParams,
} from './types'

const BASE_URL = 'https://f1tv.formula1.com'
const USER_AGENT = 'f1-blog/1.0'

interface ClientState {
  location: F1TVLocationResult | null
  entitlementToken: string | null
  config: F1TVConfig | null
}

const clientState: ClientState = {
  location: null,
  entitlementToken: null,
  config: null,
}

async function f1tvFetch(url: string, extraHeaders?: Record<string, string>): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      ...extraHeaders,
    },
  })
}

function loginStatus(token: string | null): 'A' | 'R' {
  return token ? 'R' : 'A'
}

function buildUrl(
  parts: string[],
  token: string | null,
  language: F1TVLanguage = 'ENG' as F1TVLanguage,
  platform: F1TVPlatform = 'WEB_HLS' as F1TVPlatform
): string {
  return [BASE_URL, ...parts.slice(0, 1), loginStatus(token), language, platform, ...parts.slice(1)].join('/')
}

export async function refreshLocation(token: string): Promise<F1TVLocationResult> {
  const url = buildUrl(['1.0', 'ALL/USER/LOCATION'], token)
  const res = await f1tvFetch(url)
  if (!res.ok) throw new Error(`Location fetch failed (${res.status})`)

  const data = (await res.json()) as F1TVApiResult<F1TVLocationResult>
  clientState.location = data.resultObj
  return data.resultObj
}

export async function refreshEntitlement(token: string): Promise<string> {
  const url = buildUrl(['2.0', 'ALL/USER/ENTITLEMENT'], token)
  const res = await f1tvFetch(url, { ascendontoken: token })
  if (!res.ok) throw new Error(`Entitlement fetch failed (${res.status})`)

  const data = (await res.json()) as F1TVApiResult<F1TVEntitlementResult>
  clientState.entitlementToken = data.resultObj.entitlementToken
  return data.resultObj.entitlementToken
}

export async function refreshConfig(): Promise<F1TVConfig> {
  const res = await f1tvFetch(`${BASE_URL}/config`)
  if (!res.ok) throw new Error(`Config fetch failed (${res.status})`)

  const config = (await res.json()) as F1TVConfig
  clientState.config = config
  return config
}

export async function initializeClient(): Promise<void> {
  const token = await ensureAuthenticated()
  await refreshLocation(token)
  await refreshEntitlement(token)
  await refreshConfig()
}

export async function getContentPlayUrl(
  contentId: number,
  channelId?: number
): Promise<F1TVContentPlayResult> {
  const token = await ensureAuthenticated()

  if (!clientState.entitlementToken) {
    await refreshEntitlement(token)
  }

  const params = new URLSearchParams({ contentId: contentId.toString() })
  if (channelId) params.set('channelId', channelId.toString())

  const url = buildUrl(['2.0', 'ALL/CONTENT/PLAY'], token) + '?' + params.toString()
  const res = await f1tvFetch(url, {
    ascendontoken: token,
    entitlementtoken: clientState.entitlementToken!,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Content play failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as F1TVApiResult<Record<string, unknown>>
  const result = data.resultObj ?? {}

  const streamType = String(result.streamType ?? 'HLS')
  const drmType = typeof result.drmType === 'string' ? result.drmType : undefined
  const laURL =
    (typeof result.laURL === 'string' && result.laURL) ||
    (typeof result.laUrl === 'string' && result.laUrl) ||
    (typeof result.licenseUrl === 'string' && result.licenseUrl) ||
    undefined

  const normalizedChannelId =
    typeof result.channelId === 'number'
      ? result.channelId
      : typeof channelId === 'number'
        ? channelId
        : 0

  const fallbackLaURL =
    !laURL && streamType.includes('DASH') && (drmType === 'widevine' || streamType.includes('WV'))
      ? `${BASE_URL}/2.0/R/ENG/WEB_HLS/ALL/CONTENT/LA/widevine?contentId=${contentId}${normalizedChannelId ? `&channelId=${normalizedChannelId}` : ''}`
      : undefined

  const entitlementToken =
    typeof result.entitlementToken === 'string' && result.entitlementToken.length > 0
      ? result.entitlementToken
      : clientState.entitlementToken

  const playbackUrl =
    typeof result.url === 'string' && result.url.length > 0
      ? result.url
      : null

  if (!entitlementToken || !playbackUrl) {
    throw new Error('Invalid content play response: missing entitlementToken or url')
  }

  const settings =
    typeof result.settings === 'object' && result.settings !== null
      ? (result.settings as F1TVContentPlayResult['settings'])
      : { upnext: { jitter: 0 } }

  return {
    entitlementToken,
    url: playbackUrl,
    streamType: streamType as F1TVContentPlayResult['streamType'],
    drmType: (drmType as F1TVContentPlayResult['drmType']) ?? undefined,
    laURL: laURL ?? fallbackLaURL,
    drmToken: typeof result.drmToken === 'string' ? result.drmToken : undefined,
    channelId: normalizedChannelId,
    settings,
  }
}

export async function getContentVideo(contentId: number): Promise<F1TVContentVideoContainer> {
  const token = await ensureAuthenticated()

  if (!clientState.location) {
    await refreshLocation(token)
  }

  const loc = clientState.location!.userLocation[0]
  const url = [
    BASE_URL,
    '4.0',
    loginStatus(token),
    'ENG',
    'WEB_HLS',
    'ALL/CONTENT/VIDEO',
    contentId.toString(),
    loc.entitlement,
    loc.groupId.toString(),
  ].join('/')

  const headers: Record<string, string> = {}
  if (clientState.entitlementToken) {
    headers.entitlementtoken = clientState.entitlementToken
  }

  const res = await f1tvFetch(url, headers)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Content video failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as F1TVApiResult<F1TVContentVideoResult>
  if (data.resultObj.containers.length === 0) {
    throw new Error('No content containers found')
  }

  return data.resultObj.containers[0]
}

export async function getLiveNow(): Promise<F1TVLiveNowResult> {
  const token = await ensureAuthenticated()

  if (!clientState.location) {
    await refreshLocation(token)
  }

  const loc = clientState.location!.userLocation[0]
  const url = buildUrl(
    ['1.0', `ALL/EVENTS/LIVENOW/${loc.entitlement}/${loc.groupId}`],
    token
  )

  const res = await f1tvFetch(url)
  if (!res.ok) throw new Error(`Live now failed (${res.status})`)

  const data = (await res.json()) as F1TVApiResult<F1TVLiveNowResult>
  return data.resultObj
}

export async function searchVod(
  params?: F1TVSearchVodParams
): Promise<F1TVApiResult<{ total: number; containers: unknown[] }>> {
  const token = await ensureAuthenticated()

  if (!clientState.location) {
    await refreshLocation(token)
  }

  const loc = clientState.location!.userLocation[0]
  let url = buildUrl(
    ['2.0', `ALL/PAGE/SEARCH/VOD/${loc.entitlement}/${loc.groupId}`],
    token
  )

  if (params) {
    url += '?' + new URLSearchParams(params as Record<string, string>).toString()
  }

  const res = await f1tvFetch(url)
  const data = await res.json()

  if (data.resultObj) return data

  throw new Error(`Search VOD failed (${res.status}): ${JSON.stringify(data)}`)
}

export function getClientState(): Readonly<ClientState> {
  return clientState
}

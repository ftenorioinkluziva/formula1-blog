export interface F1TVApiResult<T> {
  resultCode: string
  message: string
  errorDescription: string
  resultObj: T
  systemTime: number
}

export interface F1TVLocationResult {
  userLocation: {
    detectedCountryIsoCode: string
    registeredCountryIsoCode: string
    detectedCountryIsoCodeAlpha3: string
    registeredCountryIsoCodeAlpha3: string
    groupId: number
    entitlement: 'ANONYMOUS' | 'REG' | 'PRO' | 'VIP' | 'OPS'
  }[]
  countries: unknown[]
}

export interface F1TVEntitlementResult {
  entitlementToken: string
}

export interface F1TVContentPlayResult {
  entitlementToken: string
  url: string
  streamType: string
  drmType?: 'widevine'
  laURL?: string
  drmToken?: string
  channelId: number
  settings: {
    upnext: { jitter: number }
  }
}

export interface F1TVPlaybackStream {
  url: string
  streamType: F1TVContentPlayResult['streamType']
  laURL: string | null
  drmToken: string | null
  channelId: number
}

export interface F1TVAdditionalStream {
  racingNumber: number
  driverFirstName?: string
  driverLastName?: string
  constructorName?: string
  teamName: string
  type: 'additional' | 'obc'
  playbackUrl: string
  driverImg: string
  teamImg: string
  hex?: string
  channelId: number
  title: string
  reportingName: string
  default: boolean
  identifier: 'PRES' | 'WIF' | 'TRACKER' | 'DATA' | 'OBC'
}

export interface F1TVContentVideoContainer {
  metadata: {
    contentId: number
    title: string
    titleBrief: string
    longDescription: string
    shortDescription: string
    duration: number
    season: number
    pictureUrl: string
    contentType: string
    contentSubtype: string
    objectType: string
    genres: string[]
    isOnAir: boolean
    isEncrypted: boolean
    locked: boolean
    entitlement: string
    emfAttributes: {
      VideoType: string
      MeetingKey: string
      MeetingSessionKey: string
      Meeting_Name: string
      Meeting_Number: string
      Circuit_Short_Name: string
      Meeting_Location: string
      Series: string
      OBC: boolean
      state: string
      Global_Title: string
      Global_Meeting_Name: string
      Meeting_Country_Name: string
      Global_Meeting_Country_Name: string
      sessionStartDate: string
      sessionEndDate: string
      sessionEndTime: string
      [key: string]: unknown
    }
    additionalStreams?: F1TVAdditionalStream[]
    [key: string]: unknown
  }
  contentId: number
  id: number
  [key: string]: unknown
}

export interface F1TVContentVideoResult {
  total: number
  containers: F1TVContentVideoContainer[]
}

export interface F1TVLiveNowItem {
  metadata: {
    contentId: number
    title: string
    titleBrief: string
    emfAttributes: {
      Meeting_Name: string
      Meeting_Location: string
      state: string
      [key: string]: unknown
    }
    isOnAir: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface F1TVLiveNowResult {
  pollingLower: number
  pollingUpper: number
  items: F1TVLiveNowItem[]
}

export interface F1TVSearchVodParams {
  filter_genres?: string
  filter_MeetingKey?: string
  filter_objectSubtype?: string
  filter_orderByFom?: string
  filter_season?: string
  filter_year?: string
  maxResults?: string
  orderBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface F1TVDecodedToken {
  ExternalAuthorizationsContextData: string
  SubscriptionStatus: string
  SubscriberId: string
  FirstName: string
  LastName: string
  exp: number
  iat: number
  SessionId: string
  SubscribedProduct: string
  jti: string
  ents: { country: string; ent: string }[]
}

export enum F1TVLanguage {
  ENGLISH = 'ENG',
  DUTCH = 'NLD',
  PORTUGUESE = 'POR',
  SPANISH = 'SPA',
  GERMAN = 'DEU',
  FRENCH = 'FRA',
}

export enum F1TVPlatform {
  WEB_DASH = 'WEB_DASH',
  WEB_HLS = 'WEB_HLS',
  MOBILE_DASH = 'MOBILE_DASH',
  MOBILE_HLS = 'MOBILE_HLS',
  BIG_SCREEN_DASH = 'BIG_SCREEN_DASH',
  BIG_SCREEN_HLS = 'BIG_SCREEN_HLS',
}

export interface F1TVConfig {
  apiConfig: {
    proto: string
    domain: string
    prefix: string
    version: string
    channel: string
    playAPIVersion: string
    videoAPIVersion: string
  }
  authentication: {
    domain: string
    apiKey: string
    distributionChannel: string
    systemID: string
    deviceType: number
    url: { rendezvousRegisterDevice: string }
  }
  authLinks: {
    login: string
    subscribe: string
    manageAccount: string
    subscription: string
    verify: string
  }
  supportedLanguages: string[]
  [key: string]: unknown
}

import type { F1TVContentPlayResult, F1TVPlaybackStream } from './types'

export type { F1TVPlaybackStream }

export function getPlaybackLicenseUrl(locale: string | null | undefined, laURL: string): string {
  const normalizedLocale = locale?.trim() || 'en'
  return `/${normalizedLocale}/api/f1tv/license?laURL=${encodeURIComponent(laURL)}`
}

export function createPlaybackStream(playResult: F1TVContentPlayResult): F1TVPlaybackStream {
  return {
    url: playResult.url,
    streamType: playResult.streamType,
    laURL: playResult.laURL ?? null,
    drmToken: playResult.drmToken ?? playResult.entitlementToken ?? null,
    channelId: playResult.channelId,
  }
}

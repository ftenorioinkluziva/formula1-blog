import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createPlaybackStream, getPlaybackLicenseUrl } from '../lib/f1tv/playback'

const stream = createPlaybackStream({
  entitlementToken: 'entitlement-token',
  url: 'https://example.com/stream.mpd',
  streamType: 'DASHWV',
  drmType: 'widevine',
  laURL: 'https://f1tv.formula1.com/license',
  channelId: 1025,
  settings: { upnext: { jitter: 0 } },
})

assert.equal(stream.url, 'https://example.com/stream.mpd')
assert.equal(stream.streamType, 'DASHWV')
assert.equal(stream.laURL, 'https://f1tv.formula1.com/license')
assert.equal(stream.drmToken, 'entitlement-token')
assert.equal(stream.channelId, 1025)

assert.equal(getPlaybackLicenseUrl('pt', 'https://f1tv.formula1.com/license'), '/pt/api/f1tv/license?laURL=https%3A%2F%2Ff1tv.formula1.com%2Flicense')

const playerSource = fs.readFileSync(path.join(process.cwd(), 'components/live/f1tv-player.tsx'), 'utf8')
assert.ok(playerSource.includes('getPlaybackLicenseUrl(locale, laURL)'))
assert.ok(!playerSource.includes('window.location.pathname'))

console.log('F1TV playback contract verified')

const F1TV_LIVE_TIMING = 'https://livetiming.formula1.com'
const F1TV_API = 'https://f1tv.formula1.com'
const F1TV_ACCOUNT_API = 'https://api.formula1.com'

const FWD_HEADERS = {
  Origin: 'https://www.formula1.com',
  Referer: 'https://www.formula1.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname.startsWith('/signalrcore')) {
      return handleSignalRProxy(request, url)
    }

    if (url.pathname === '/f1tv/audio' && ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return handleF1TVAudio(request, url)
    }

    if (url.pathname === '/f1tv/play' && request.method === 'POST') {
      return handleF1TVPlay(request, env)
    }

    if (url.pathname === '/f1tv/auth' && request.method === 'POST') {
      return handleF1TVAuth(request, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Range,x-f1tv-proxy-secret',
    'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges,Content-Type',
  }
}

async function handleSignalRProxy(request, url) {
  const targetUrl = `${F1TV_LIVE_TIMING}${url.pathname}${url.search}`

  const headers = new Headers(request.headers)
  for (const [key, value] of Object.entries(FWD_HEADERS)) {
    headers.set(key, value)
  }

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'manual',
  })

  return fetch(modifiedRequest)
}

async function handleF1TVAudio(request, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  const audioUrl = sanitizeLiveTimingAudioUrl(url.searchParams.get('url'))
  if (!audioUrl) {
    return jsonResponse(
      { error: 'Invalid or missing url parameter' },
      400,
      corsHeaders(),
    )
  }

  const headers = new Headers({
    ...FWD_HEADERS,
    Accept: 'audio/mpeg,audio/mp3,audio/*;q=0.9,*/*;q=0.8',
  })
  const range = request.headers.get('range')
  if (range) headers.set('Range', range)

  const upstream = await fetch(audioUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
  })

  const responseHeaders = new Headers(corsHeaders())
  for (const name of [
    'accept-ranges',
    'cache-control',
    'content-length',
    'content-range',
    'content-type',
    'etag',
    'last-modified',
  ]) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'audio/mpeg')
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

function sanitizeLiveTimingAudioUrl(raw) {
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    if (url.hostname !== 'livetiming.formula1.com') return null
    if (!url.pathname.startsWith('/static/')) return null
    if (!url.pathname.includes('/TeamRadio/')) return null
    if (!url.pathname.endsWith('.mp3')) return null
    return url.toString()
  } catch {
    return null
  }
}

async function handleF1TVPlay(request, env) {
  try {
    const forbidden = validateProxySecret(request, env)
    if (forbidden) {
      return forbidden
    }

    const { contentId, channelId, subscriptionToken, entitlementToken } = await request.json()

    if (!contentId || !subscriptionToken) {
      return new Response(JSON.stringify({ error: 'Missing required fields: contentId, subscriptionToken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const params = new URLSearchParams({ contentId: String(contentId) })
    if (channelId) params.set('channelId', String(channelId))

    const url = `${F1TV_API}/2.0/R/ENG/WEB_HLS/ALL/CONTENT/PLAY?${params}`

    const headers = {
      ...FWD_HEADERS,
      ascendontoken: subscriptionToken,
    }
    if (entitlementToken) {
      headers.entitlementtoken = entitlementToken
    }

    const response = await fetch(url, { headers })

    const body = await response.text()

    if (!response.ok) {
      return new Response(body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let data
    try {
      data = JSON.parse(body)
    } catch {
      return new Response(body, {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleF1TVAuth(request, env) {
  try {
    const forbidden = validateProxySecret(request, env)
    if (forbidden) {
      return forbidden
    }

    const { email, password, apiKey } = await request.json()

    if (!email || !password || !apiKey) {
      return jsonResponse(
        { error: 'Missing required fields: email, password, apiKey' },
        400,
      )
    }

    const response = await fetch(
      `${F1TV_ACCOUNT_API}/v2/account/subscriber/authenticate/by-password`,
      {
        method: 'POST',
        headers: {
          ...FWD_HEADERS,
          'Content-Type': 'application/json',
          apiKey,
        },
        body: JSON.stringify({ Login: email, Password: password }),
      },
    )

    const body = await response.text()
    let data
    try {
      data = JSON.parse(body)
    } catch {
      return jsonResponse(
        {
          error: `F1 auth API returned non-JSON (${response.status})`,
          preview: body.slice(0, 160),
        },
        502,
      )
    }

    if (!response.ok || data?.resultCode === 'ERR' || data?.errorDescription) {
      return jsonResponse(data, response.ok ? 401 : response.status)
    }

    const subscriptionToken = data?.data?.subscriptionToken
    if (!subscriptionToken) {
      return jsonResponse({ error: 'No subscription token in F1 auth response' }, 502)
    }

    return jsonResponse({
      subscriptionToken,
      rawCookieValue: encodeURIComponent(
        JSON.stringify({ data: { subscriptionToken } }),
      ),
    })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

function validateProxySecret(request, env) {
  const secret = request.headers.get('x-f1tv-proxy-secret')
  if (!secret || secret !== (env?.F1TV_PROXY_SECRET || '777b8f203a5716e238765bff5417ba00d56400f97f5838e699621b820a8d2eaf')) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return null
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

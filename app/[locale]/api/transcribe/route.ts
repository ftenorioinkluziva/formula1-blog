import { NextRequest, NextResponse } from "next/server"
import { File as NodeFile } from "node:buffer"
import OpenAI, { APIError } from "openai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function ensureFileGlobal(): void {
  if (typeof globalThis.File === "undefined") {
    Object.defineProperty(globalThis, "File", {
      value: NodeFile,
      configurable: true,
      writable: true,
    })
  }
}

const ALLOWED_HOSTS = new Set([
  "livetiming.formula1.com",
])

const MAX_AUDIO_SIZE = 25 * 1024 * 1024
const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/*;q=0.9,*/*;q=0.8"
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

const ALLOWED_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
])

function isPrivateIp(hostname: string): boolean {
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^fc00:/i,
    /^fe80:/i,
    /^::1$/,
    /^localhost$/i,
  ]
  return privateRanges.some((r) => r.test(hostname))
}

function validateAudioUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (isPrivateIp(parsed.hostname)) return null
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null

  return parsed
}

function buildAudioProxyUrl(audioUrl: string): string | null {
  const endpoint = getAudioProxyEndpoint()
  if (!endpoint) return null

  const separator = endpoint.includes("?") ? "&" : "?"
  return `${endpoint}${separator}url=${encodeURIComponent(audioUrl)}`
}

function getAudioProxyEndpoint(): string | null {
  if (process.env.F1TV_AUDIO_PROXY_URL) {
    return process.env.F1TV_AUDIO_PROXY_URL
  }

  const segmentEndpoint = deriveAudioProxyFromSegmentProxy(process.env.F1TV_SEGMENT_PROXY_URL)
  if (segmentEndpoint) return segmentEndpoint

  return deriveAudioProxyFromBaseProxy(process.env.F1TV_PROXY_URL)
}

function deriveAudioProxyFromSegmentProxy(raw: string | undefined): string | null {
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (!url.pathname.endsWith("/f1tv/segment")) return null
    url.pathname = url.pathname.replace(/\/f1tv\/segment$/, "/f1tv/audio")
    return url.toString()
  } catch {
    return null
  }
}

function deriveAudioProxyFromBaseProxy(raw: string | undefined): string | null {
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/f1tv/audio"
      return url.toString()
    }

    if (url.pathname.endsWith("/f1tv/play")) {
      url.pathname = url.pathname.replace(/\/f1tv\/play$/, "/f1tv/audio")
      return url.toString()
    }

    if (url.pathname.endsWith("/f1tv/auth")) {
      url.pathname = url.pathname.replace(/\/f1tv\/auth$/, "/f1tv/audio")
      return url.toString()
    }

    if (!url.pathname.endsWith("/f1tv/audio")) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/f1tv/audio`
    }
    return url.toString()
  } catch {
    return null
  }
}

async function fetchAudioDirect(url: URL): Promise<Response> {
  return fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: AUDIO_ACCEPT,
      "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
      "User-Agent": BROWSER_USER_AGENT,
    },
    signal: AbortSignal.timeout(30_000),
  })
}

async function fetchAudioViaProxy(url: URL): Promise<Response | null> {
  const proxyUrl = buildAudioProxyUrl(url.toString())
  if (!proxyUrl) return null

  const headers: Record<string, string> = {
    Accept: AUDIO_ACCEPT,
  }
  if (process.env.F1TV_PROXY_SECRET) {
    headers["x-f1tv-proxy-secret"] = process.env.F1TV_PROXY_SECRET
  }

  return fetch(proxyUrl, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(30_000),
  })
}

async function fetchAudio(url: URL): Promise<Response> {
  const directResponse = await fetchAudioDirect(url)
  if (directResponse.ok || (directResponse.status !== 403 && directResponse.status !== 451)) {
    return directResponse
  }

  const proxyResponse = await fetchAudioViaProxy(url)
  return proxyResponse ?? directResponse
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Transcription service unavailable" },
        { status: 503 },
      )
    }

    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || !("audioUrl" in body)) {
      return NextResponse.json(
        { error: "audioUrl is required" },
        { status: 400 },
      )
    }

    const url = validateAudioUrl((body as { audioUrl: unknown }).audioUrl)
    if (!url) {
      return NextResponse.json(
        { error: "Invalid or disallowed audio URL" },
        { status: 400 },
      )
    }

    const audioResponse = await fetchAudio(url)

    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch audio: ${audioResponse.status}` },
        { status: 400 },
      )
    }

    const contentType = audioResponse.headers.get("content-type")?.split(";")[0]?.trim()
    if (contentType && !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "URL does not point to a supported audio format" },
        { status: 400 },
      )
    }

    const contentLength = Number(audioResponse.headers.get("content-length") ?? 0)
    if (contentLength > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file exceeds 25 MB limit" },
        { status: 400 },
      )
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    if (audioBuffer.byteLength > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file exceeds 25 MB limit" },
        { status: 400 },
      )
    }

    let transcription: { text: string }
    try {
      ensureFileGlobal()
      transcription = await getOpenAI().audio.transcriptions.create({
        file: new NodeFile([Buffer.from(audioBuffer)], "audio.mp3", { type: "audio/mpeg" }) as unknown as File,
        model: "whisper-1",
        language: "en",
      })
    } catch (error) {
      const status = error instanceof APIError ? error.status : 502
      const message = error instanceof Error ? error.message : "Unknown transcription provider error"
      console.error("[transcribe] OpenAI transcription failed:", message)
      return NextResponse.json(
        {
          error: "Transcription provider failed",
          providerStatus: status,
        },
        { status },
      )
    }

    return NextResponse.json({
      success: true,
      text: transcription.text,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Audio download timed out" },
        { status: 408 },
      )
    }
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 },
    )
  }
}

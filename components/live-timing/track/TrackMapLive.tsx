"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLiveTiming } from "@/components/live-timing/LiveTimingProvider"
import { COMPOUND_COLORS } from "@/lib/live-timing/constants"

const SVG_SIZE = 800
const PAD = 50
const CANVAS = SVG_SIZE - PAD * 2      // 700
const FLUSH_EVERY = 6
const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const ZOOM_STEP = 1.4                  // per button click
const ZOOM_WHEEL = 1.12               // per wheel tick
const MIN_LERP_TAU = 180              // ms
const MAX_LERP_TAU = 900              // ms
const TAU_FACTOR = 0.9
const MIN_STREAM_BUFFER_MS = 650
const MAX_STREAM_BUFFER_MS = 1200
const STREAM_BUFFER_FACTOR = 0.78
const STREAM_JITTER_FACTOR = 1.6
const MAX_SAMPLES_PER_CAR = 8
const MAX_TRACK_POINTS_STORED = 6000
const MAX_TRACK_POINTS_RENDERED = 1800
const TRACK_DOT_KEY_STEP = 2
const TRACK_MIN_MOVE_FOR_DOT = 1.4

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface CarInfo {
  racingNumber: string
  tla: string
  fullName: string
  teamColour: string
  onTrack: boolean
}

interface PositionSample {
  x: number
  y: number
  t: number
}

interface TrackDebugStats {
  pollIntervalMs: number
  pollJitterMs: number
  lerpTauMs: number
  streamBufferMs: number
  holdFrames: number
  edgeCars: number
  sampleAgeMs: number
}

interface TrackTuneConfig {
  tauFactor: number
  minLerpTau: number
  maxLerpTau: number
  minBuffer: number
  maxBuffer: number
  bufferFactor: number
  jitterFactor: number
}

const TRACK_STATUS_CONFIG: Record<string, { label: string; color: string; dotClass: string }> = {
  AllClear: { label: "Pista Livre", color: "var(--status-success)", dotClass: "bg-green-500" },
  Yellow: { label: "Bandeira Amarela", color: "var(--status-warning)", dotClass: "bg-yellow-400" },
  SCDeployed: { label: "Safety Car", color: "var(--status-orange)", dotClass: "bg-orange-400" },
  VSCDeployed: { label: "VSC Ativado", color: "var(--status-vsc)", dotClass: "bg-orange-500" },
  VSCEnding: { label: "VSC Encerrando", color: "var(--status-vsc-ending)", dotClass: "bg-orange-600" },
  Red: { label: "Bandeira Vermelha", color: "var(--status-danger)", dotClass: "bg-red-500" },
}

const SESSION_STATUS_CONFIG: Record<string, { label: string; color: string; dotClass: string }> = {
  Started: { label: "Sessão Iniciada", color: "var(--status-success)", dotClass: "bg-green-400" },
  Finished: { label: "Sessão Encerrada", color: "var(--muted-foreground)", dotClass: "bg-muted-foreground" },
  Finalised: { label: "Sessão Finalizada", color: "var(--muted-foreground)", dotClass: "bg-muted-foreground" },
  Aborted: { label: "Sessão Abortada", color: "var(--status-danger)", dotClass: "bg-red-500" },
  Inactive: { label: "Inativa", color: "var(--muted-foreground)", dotClass: "bg-secondary/80" },
}

interface AnimState {
  currX: number
  currY: number
  targetX: number
  targetY: number
  samples: PositionSample[]
}

function renderBounds(minX: number, maxX: number, minY: number, maxY: number): Bounds {
  const padX = (maxX - minX) * 0.15
  const padY = (maxY - minY) * 0.15
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  }
}

function normalize(x: number, y: number, b: Bounds): { nx: number; ny: number } {
  const spanX = b.maxX - b.minX || 1
  const spanY = b.maxY - b.minY || 1
  const scale = Math.min(CANVAS / spanX, CANVAS / spanY)
  const drawW = spanX * scale
  const drawH = spanY * scale
  const ox = PAD + (CANVAS - drawW) / 2
  const oy = PAD + (CANVAS - drawH) / 2
  return {
    nx: ox + (x - b.minX) * scale,
    ny: oy + (b.maxY - y) * scale,
  }
}

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
}

function toColour(raw?: string): string {
  if (!raw) return "var(--muted-foreground)"
  return raw.startsWith("#") ? raw : `#${raw}`
}

export function TrackMapLive() {
  const { positions, drivers, trackStatus, sessionState } = useLiveTiming()

  // Driver metadata cache
  const driverMapRef = useRef(new Map<string, { tla: string; fullName: string; teamColour: string }>())

  // Track bounds / accumulated dot cloud
  const rawMinMaxRef = useRef({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const boundsRef = useRef<Bounds | null>(null)
  const rawDotsRef = useRef(new Map<string, { x: number; y: number }>())
  const lastTrackDotByCarRef = useRef(new Map<string, { x: number; y: number }>())
  const flushCountRef = useRef(0)

  // React state — does NOT store car positions (those live in animStatesRef)
  const [trackSnapshot, setTrackSnapshot] = useState<{ nx: number; ny: number }[]>([])
  const [carsList, setCarsList] = useState<CarInfo[]>([])
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugStats, setDebugStats] = useState<TrackDebugStats>({
    pollIntervalMs: 0,
    pollJitterMs: 0,
    lerpTauMs: 0,
    streamBufferMs: 0,
    holdFrames: 0,
    edgeCars: 0,
    sampleAgeMs: 0,
  })
  const [tuneConfig, setTuneConfig] = useState<TrackTuneConfig>({
    tauFactor: TAU_FACTOR,
    minLerpTau: MIN_LERP_TAU,
    maxLerpTau: MAX_LERP_TAU,
    minBuffer: MIN_STREAM_BUFFER_MS,
    maxBuffer: MAX_STREAM_BUFFER_MS,
    bufferFactor: STREAM_BUFFER_FACTOR,
    jitterFactor: STREAM_JITTER_FACTOR,
  })

  // ── rAF animation ──────────────────────────────────────────────────────────
  const animStatesRef = useRef(new Map<string, AnimState>())
  const gElementsRef = useRef(new Map<string, SVGGElement>())
  const rafIdRef = useRef<number>(0)
  const isAnimatingRef = useRef(false)
  const prevFrameTimeRef = useRef(0)
  const lastBatchTsRef = useRef<number | null>(null)
  const smoothIntervalRef = useRef(1000)
  const jitterRef = useRef(120)
  const lerpTauRef = useRef(520)
  const streamBufferMsRef = useRef(650)
  const holdFramesRef = useRef(0)
  const debugLastReportRef = useRef(0)
  const debugEnabledRef = useRef(false)
  const tauFactorRef = useRef(TAU_FACTOR)
  const minLerpTauRef = useRef(MIN_LERP_TAU)
  const maxLerpTauRef = useRef(MAX_LERP_TAU)
  const minBufferRef = useRef(MIN_STREAM_BUFFER_MS)
  const maxBufferRef = useRef(MAX_STREAM_BUFFER_MS)
  const bufferFactorRef = useRef(STREAM_BUFFER_FACTOR)
  const jitterFactorRef = useRef(STREAM_JITTER_FACTOR)

  useEffect(() => {
    if (typeof window === "undefined") return
    const query = new URLSearchParams(window.location.search)
    const enabled = query.get("trackDebug") === "1"
    setDebugEnabled(enabled)
    debugEnabledRef.current = enabled
  }, [])

  useEffect(() => {
    tauFactorRef.current = tuneConfig.tauFactor
    minLerpTauRef.current = tuneConfig.minLerpTau
    maxLerpTauRef.current = tuneConfig.maxLerpTau
    minBufferRef.current = tuneConfig.minBuffer
    maxBufferRef.current = tuneConfig.maxBuffer
    bufferFactorRef.current = tuneConfig.bufferFactor
    jitterFactorRef.current = tuneConfig.jitterFactor
  }, [tuneConfig])

  // ── Viewport state ─────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Drag state
  const dragRef = useRef<{
    pointerId: number
    startMouseX: number
    startMouseY: number
    startPanX: number
    startPanY: number
  } | null>(null)

  // Keep refs in sync with state (used inside event handlers to avoid stale closures)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // ── rAF loop: exponential lerp → direct DOM writes, no React re-renders ────
  const startAnimation = useCallback(() => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true
    prevFrameTimeRef.current = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(now - prevFrameTimeRef.current, 100)
      prevFrameTimeRef.current = now
      const alpha = 1 - Math.exp(-dt / lerpTauRef.current)
      const playbackTs = now - streamBufferMsRef.current
      let edgeCars = 0
      let maxSampleAgeMs = 0

      for (const [id, state] of animStatesRef.current) {
        const samples = state.samples
        while (samples.length > 2 && samples[1].t <= playbackTs) {
          samples.shift()
        }

        if (samples.length >= 2) {
          const a = samples[0]
          const b = samples[1]
          if (playbackTs <= a.t) {
            state.targetX = a.x
            state.targetY = a.y
          } else if (playbackTs >= b.t) {
            state.targetX = b.x
            state.targetY = b.y
            edgeCars++
          } else {
            const span = Math.max(b.t - a.t, 1)
            const k = (playbackTs - a.t) / span
            state.targetX = a.x + (b.x - a.x) * k
            state.targetY = a.y + (b.y - a.y) * k
          }
        } else if (samples.length === 1) {
          state.targetX = samples[0].x
          state.targetY = samples[0].y
        }

        const dx = state.targetX - state.currX
        const dy = state.targetY - state.currY
        state.currX += dx * alpha
        state.currY += dy * alpha
        const el = gElementsRef.current.get(id)
        if (el) {
          el.setAttribute("transform", `translate(${state.currX.toFixed(2)},${state.currY.toFixed(2)})`)
        }

        if (samples.length > 0) {
          const sampleAge = now - samples[samples.length - 1].t
          if (sampleAge > maxSampleAgeMs) {
            maxSampleAgeMs = sampleAge
          }
        }
      }

      if (edgeCars > 0) {
        holdFramesRef.current += 1
      }

      if (debugEnabledRef.current && now - debugLastReportRef.current >= 250) {
        debugLastReportRef.current = now
        setDebugStats({
          pollIntervalMs: Math.round(smoothIntervalRef.current),
          pollJitterMs: Math.round(jitterRef.current),
          lerpTauMs: Math.round(lerpTauRef.current),
          streamBufferMs: Math.round(streamBufferMsRef.current),
          holdFrames: holdFramesRef.current,
          edgeCars,
          sampleAgeMs: Math.round(maxSampleAgeMs),
        })
      }

      if (gElementsRef.current.size > 0) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        isAnimatingRef.current = false
      }
    }

    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  // Cancel rAF on unmount
  useEffect(() => () => { cancelAnimationFrame(rafIdRef.current) }, [])

  // ── Driver metadata ────────────────────────────────────────────────────────
  useEffect(() => {
    drivers.forEach(d => {
      driverMapRef.current.set(d.racingNumber, {
        tla: d.tla,
        fullName: d.fullName,
        teamColour: toColour(d.teamColour),
      })
    })
  }, [drivers])

  // ── Process incoming position batch ───────────────────────────────────────
  useEffect(() => {
    const entries = positions?.entries
    if (!entries?.length) return

    const uniqueEntriesByNumber = new Map<string, (typeof entries)[number]>()
    for (const entry of entries) {
      uniqueEntriesByNumber.set(entry.racingNumber, entry)
    }
    const uniqueEntries = Array.from(uniqueEntriesByNumber.values())

    let boundsChanged = false
    const rm = rawMinMaxRef.current
    for (const e of uniqueEntries) {
      if (e.x < rm.minX) { rm.minX = e.x; boundsChanged = true }
      if (e.x > rm.maxX) { rm.maxX = e.x; boundsChanged = true }
      if (e.y < rm.minY) { rm.minY = e.y; boundsChanged = true }
      if (e.y > rm.maxY) { rm.maxY = e.y; boundsChanged = true }
    }
    if (!boundsRef.current) boundsChanged = true

    if (boundsChanged) {
      boundsRef.current = renderBounds(rm.minX, rm.maxX, rm.minY, rm.maxY)
    }
    const bounds = boundsRef.current!
    const now = performance.now()

    if (lastBatchTsRef.current !== null) {
      const rawInterval = now - lastBatchTsRef.current
      const boundedInterval = Math.max(200, Math.min(2000, rawInterval))
      smoothIntervalRef.current = smoothIntervalRef.current * 0.8 + boundedInterval * 0.2
      const intervalJitter = Math.abs(boundedInterval - smoothIntervalRef.current)
      jitterRef.current = jitterRef.current * 0.8 + intervalJitter * 0.2
      const nextTau = smoothIntervalRef.current * tauFactorRef.current
      lerpTauRef.current = Math.max(minLerpTauRef.current, Math.min(maxLerpTauRef.current, nextTau))
      const nextStreamBuffer =
        smoothIntervalRef.current * bufferFactorRef.current + jitterRef.current * jitterFactorRef.current
      streamBufferMsRef.current = Math.max(
        minBufferRef.current,
        Math.min(maxBufferRef.current, nextStreamBuffer),
      )

      if (debugEnabledRef.current) {
        setDebugStats((prev) => ({
          ...prev,
          pollIntervalMs: Math.round(smoothIntervalRef.current),
          pollJitterMs: Math.round(jitterRef.current),
          lerpTauMs: Math.round(lerpTauRef.current),
          streamBufferMs: Math.round(streamBufferMsRef.current),
        }))
      }
    }
    lastBatchTsRef.current = now

    const newCarsList: CarInfo[] = uniqueEntries.map(entry => {
      const info = driverMapRef.current.get(entry.racingNumber)
      const { nx, ny } = normalize(entry.x, entry.y, bounds)

      const existing = animStatesRef.current.get(entry.racingNumber)
      if (existing) {
        if (boundsChanged) {
          existing.currX = nx
          existing.currY = ny
          existing.samples = [{ x: nx, y: ny, t: now }]
        }
        const lastSample = existing.samples[existing.samples.length - 1]
        if (!lastSample || lastSample.x !== nx || lastSample.y !== ny) {
          existing.samples.push({ x: nx, y: ny, t: now })
          if (existing.samples.length > MAX_SAMPLES_PER_CAR) {
            existing.samples.splice(0, existing.samples.length - MAX_SAMPLES_PER_CAR)
          }
        }
        existing.targetX = nx
        existing.targetY = ny
      } else {
        animStatesRef.current.set(entry.racingNumber, {
          currX: nx,
          currY: ny,
          targetX: nx,
          targetY: ny,
          samples: [{ x: nx, y: ny, t: now }],
        })
      }

      return {
        racingNumber: entry.racingNumber,
        tla: info?.tla ?? entry.racingNumber,
        fullName: info?.fullName ?? info?.tla ?? entry.racingNumber,
        teamColour: info?.teamColour ?? "var(--muted-foreground)",
        onTrack: entry.status === "OnTrack",
      }
    })

    // Pit cars first (behind in SVG z-order), on-track cars on top
    newCarsList.sort((a, b) => Number(a.onTrack) - Number(b.onTrack))
    setCarsList((prev) => {
      if (prev.length !== newCarsList.length) {
        return newCarsList
      }
      for (let i = 0; i < prev.length; i++) {
        const curr = prev[i]
        const next = newCarsList[i]
        if (
          curr.racingNumber !== next.racingNumber ||
          curr.tla !== next.tla ||
          curr.fullName !== next.fullName ||
          curr.teamColour !== next.teamColour ||
          curr.onTrack !== next.onTrack
        ) {
          return newCarsList
        }
      }
      return prev
    })

    const activeIds = new Set(newCarsList.map(car => car.racingNumber))
    for (const id of animStatesRef.current.keys()) {
      if (!activeIds.has(id)) {
        animStatesRef.current.delete(id)
      }
    }

    startAnimation()

    // Accumulate track outline from on-track positions
    let addedDots = false
    uniqueEntries.filter(e => e.status === "OnTrack").forEach(e => {
      const prevDot = lastTrackDotByCarRef.current.get(e.racingNumber)
      if (prevDot) {
        const dx = e.x - prevDot.x
        const dy = e.y - prevDot.y
        if (Math.hypot(dx, dy) < TRACK_MIN_MOVE_FOR_DOT) {
          return
        }
      }
      lastTrackDotByCarRef.current.set(e.racingNumber, { x: e.x, y: e.y })

      const qx = Math.round(e.x / TRACK_DOT_KEY_STEP) * TRACK_DOT_KEY_STEP
      const qy = Math.round(e.y / TRACK_DOT_KEY_STEP) * TRACK_DOT_KEY_STEP
      const key = `${qx},${qy}`
      if (!rawDotsRef.current.has(key)) {
        rawDotsRef.current.set(key, { x: qx, y: qy })
        addedDots = true
        if (rawDotsRef.current.size > MAX_TRACK_POINTS_STORED) {
          const firstKey = rawDotsRef.current.keys().next().value
          if (typeof firstKey === "string") {
            rawDotsRef.current.delete(firstKey)
          }
        }
      }
    })

    if (addedDots) {
      flushCountRef.current++
    }

    if (boundsChanged || (addedDots && flushCountRef.current >= FLUSH_EVERY)) {
      flushCountRef.current = 0
      const allDots = Array.from(rawDotsRef.current.values())
      const step = Math.max(1, Math.ceil(allDots.length / MAX_TRACK_POINTS_RENDERED))
      const reducedDots = allDots.filter((_, i) => i % step === 0)
      setTrackSnapshot(reducedDots.map(({ x, y }) => normalize(x, y, bounds)))
    }
  }, [positions, startAnimation])

  // ── Wheel zoom — anchored at cursor ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return

      const factor = e.deltaY < 0 ? ZOOM_WHEEL : 1 / ZOOM_WHEEL
      const ctm = svg.getScreenCTM()
      if (!ctm) return

      // Convert screen cursor position → SVG user-space coordinates
      // (getScreenCTM already accounts for viewBox + letterboxing)
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const { x: svgX, y: svgY } = pt.matrixTransform(ctm.inverse())

      const prevZoom = zoomRef.current
      const prevPan = panRef.current
      const newZoom = clampZoom(prevZoom * factor)

      // Derive new pan so the SVG point under cursor stays stationary:
      //   newPan.x = svgX - (svgX - pan.x) * prevZoom / newZoom
      const ratio = prevZoom / newZoom
      const newPanX = svgX - (svgX - prevPan.x) * ratio
      const newPanY = svgY - (svgY - prevPan.y) * ratio

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [carsList.length])

  // ── Pointer drag — pan ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const startDrag = (
      pointerId: number,
      clientX: number,
      clientY: number,
    ) => {
      dragRef.current = {
        pointerId,
        startMouseX: clientX,
        startMouseY: clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
      }
      el.style.cursor = "grabbing"
    }

    const updateDrag = (clientX: number, clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const viewW = SVG_SIZE / zoomRef.current
      const viewH = SVG_SIZE / zoomRef.current
      const dx = (clientX - drag.startMouseX) / rect.width * viewW
      const dy = (clientY - drag.startMouseY) / rect.height * viewH
      setPan({
        x: drag.startPanX - dx,
        y: drag.startPanY - dy,
      })
    }

    const endDrag = () => {
      if (!dragRef.current) return
      dragRef.current = null
      el.style.cursor = "grab"
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement | null)?.closest("button")) return
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      startDrag(e.pointerId, e.clientX, e.clientY)
    }

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.preventDefault()
      updateDrag(e.clientX, e.clientY)
    }

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      endDrag()
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId)
      }
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (dragRef.current?.pointerId !== e.pointerId) return
      endDrag()
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement | null)?.closest("button")) return
      startDrag(-1, e.clientX, e.clientY)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      updateDrag(e.clientX, e.clientY)
    }

    const onMouseUp = () => {
      if (!dragRef.current) return
      endDrag()
    }

    el.style.touchAction = "none"
    el.style.cursor = "grab"
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove)
    el.addEventListener("pointerup", onPointerUp)
    el.addEventListener("pointercancel", onPointerCancel)
    el.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)

    return () => {
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", onPointerUp)
      el.removeEventListener("pointercancel", onPointerCancel)
      el.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      el.style.cursor = ""
      el.style.touchAction = ""
    }
  }, [carsList.length])

  // ── Zoom button helpers — zoom around viewport centre ──────────────────────
  const zoomBy = useCallback((factor: number) => {
    const prevZoom = zoomRef.current
    const prevPan = panRef.current
    const newZoom = clampZoom(prevZoom * factor)
    const cx = prevPan.x + SVG_SIZE / prevZoom / 2
    const cy = prevPan.y + SVG_SIZE / prevZoom / 2
    setZoom(newZoom)
    setPan({ x: cx - SVG_SIZE / newZoom / 2, y: cy - SVG_SIZE / newZoom / 2 })
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // ── viewBox derived from zoom + pan ───────────────────────────────────────
  const viewW = SVG_SIZE / zoom
  const viewH = SVG_SIZE / zoom
  const viewBox = `${pan.x.toFixed(1)} ${pan.y.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}`

  const zoomPct = Math.round(zoom * 100)
  const orderedCars = [...carsList].sort((a, b) => {
    const posA = drivers.find(d => d.racingNumber === a.racingNumber)?.pos ?? 999
    const posB = drivers.find(d => d.racingNumber === b.racingNumber)?.pos ?? 999
    return posA - posB
  })

  const latestStatus = (() => {
    if (trackStatus?.message) {
      const config = TRACK_STATUS_CONFIG[trackStatus.message]
      return {
        label: config?.label || trackStatus.message,
        color: config?.color || "var(--muted-foreground)",
        dotClass: config?.dotClass || "bg-muted-foreground",
      }
    }
    if (sessionState?.status) {
      const config = SESSION_STATUS_CONFIG[sessionState.status]
      return {
        label: config?.label || sessionState.status,
        color: config?.color || "var(--muted-foreground)",
        dotClass: config?.dotClass || "bg-muted-foreground",
      }
    }
    return {
      label: "—",
      color: "var(--muted-foreground)",
      dotClass: "bg-muted-foreground",
    }
  })()

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Mapa da Pista — Ao Vivo
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="text-xs bg-background border border-border px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
            style={{ color: latestStatus.color }}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${latestStatus.dotClass}`} />
            Último status: {latestStatus.label}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 mb-4">
        Arrastar para pan · scroll com âncora no cursor · botões para zoom
      </p>

      {carsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <span className="text-2xl">🗺️</span>
          <p className="text-sm text-muted-foreground/80">Aguardando dados de posição...</p>
          <p className="text-xs text-muted-foreground/50">Position.Entries vazio ou sessão inativa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 flex flex-col">
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-lg bg-background border border-border/40 select-none flex-1"
              style={{ minHeight: "420px" }}
            >
              <div className="absolute bottom-3 right-3 z-10 flex flex-col items-center gap-1">
                <button
                  onClick={() => zoomBy(ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  title="Zoom in"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-card border border-border text-foreground/80 hover:text-foreground hover:border-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold transition-colors"
                >
                  +
                </button>
                <button
                  onClick={resetView}
                  title="Resetar zoom e pan"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-card border border-border text-muted-foreground/80 hover:text-foreground hover:border-muted-foreground transition-colors font-mono text-[10px]"
                >
                  {zoomPct}%
                </button>
                <button
                  onClick={() => zoomBy(1 / ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  title="Zoom out"
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-card border border-border text-foreground/80 hover:text-foreground hover:border-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold transition-colors"
                >
                  −
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox={viewBox}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
                style={{ display: "block" }}
              >
                <rect x={pan.x} y={pan.y} width={viewW} height={viewH} fill="var(--background)" />
                <g>
                  {trackSnapshot.map((dot, i) => (
                    <circle key={i} cx={dot.nx} cy={dot.ny} r={2} fill="var(--secondary)" />
                  ))}
                </g>
                <g>
                  {carsList.map(car => (
                    <g
                      key={car.racingNumber}
                      ref={(el: SVGGElement | null) => {
                        if (el) {
                          gElementsRef.current.set(car.racingNumber, el)
                          const state = animStatesRef.current.get(car.racingNumber)
                          if (state) {
                            el.setAttribute(
                              "transform",
                              `translate(${state.currX.toFixed(2)},${state.currY.toFixed(2)})`,
                            )
                          }
                        } else {
                          gElementsRef.current.delete(car.racingNumber)
                        }
                      }}
                    >
                      {car.onTrack ? (
                        <>
                          <circle r={10} fill={car.teamColour} />
                          <text
                            textAnchor="middle"
                            dy="0.35em"
                            fill="var(--foreground)"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                            style={{ pointerEvents: "none", userSelect: "none" }}
                          >
                            {car.racingNumber}
                          </text>
                        </>
                      ) : (
                        <>
                          <circle r={6} fill="none" stroke={car.teamColour} strokeWidth={1.5} opacity={0.5} />
                          <text
                            textAnchor="middle"
                            dy={17}
                            fill={car.teamColour}
                            fontSize={9}
                            opacity={0.4}
                            fontFamily="monospace"
                          >
                            {car.racingNumber}
                          </text>
                        </>
                      )}
                    </g>
                  ))}
                </g>
              </svg>
            </div>

            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-secondary border border-border" />
                <span className="text-xs text-muted-foreground/60">Traçado acumulado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-foreground/90" />
                <span className="text-xs text-muted-foreground/60">Em pista (cor da equipe)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-muted-foreground bg-transparent" />
                <span className="text-xs text-muted-foreground/60">No pit</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex">
            <div className="rounded-lg border border-border/60 bg-card p-3 flex-1">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                Pilotos na sessão
              </div>
              <div className="flex flex-col gap-1">
                {orderedCars.map((car) => {
                  const driverData = drivers.find(d => d.racingNumber === car.racingNumber)
                  const compound = driverData?.compound
                  const tyreLaps = driverData?.tyreLaps
                  const tireColor = compound ? (COMPOUND_COLORS[compound] ?? "var(--muted-foreground)") : null

                  return (
                    <div
                      key={`list-${car.racingNumber}`}
                      className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5"
                    >
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[11px] font-bold text-foreground"
                        style={{ backgroundColor: car.onTrack ? car.teamColour : "var(--secondary)" }}
                      >
                        {car.racingNumber}
                      </span>
                      <span className="truncate text-[11px] text-foreground/90 font-semibold flex-1" title={car.fullName}>
                        {car.fullName}
                      </span>
                      {tireColor && (
                        <div
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: tireColor }}
                          title={`${compound} — ${tyreLaps ?? "?"} voltas`}
                        >
                          <span className={`text-[9px] font-bold ${compound === "MEDIUM" || compound === "HARD" ? "text-background" : "text-foreground"}`}>
                            {tyreLaps ?? "?"}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {debugEnabled && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-200">
          <div>debug=on · use ?trackDebug=1</div>
          <div>pollInterval: {debugStats.pollIntervalMs}ms · jitter: {debugStats.pollJitterMs}ms</div>
          <div>tau: {debugStats.lerpTauMs}ms · buffer: {debugStats.streamBufferMs}ms</div>
          <div>edgeCars: {debugStats.edgeCars} · holdFrames: {debugStats.holdFrames}</div>
          <div>sampleAge(max): {debugStats.sampleAgeMs}ms</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <label className="flex items-center gap-2">
              <span className="w-24">tauFactor</span>
              <input
                type="range"
                min={0.55}
                max={1.1}
                step={0.01}
                value={tuneConfig.tauFactor}
                onChange={(e) => setTuneConfig((prev) => ({ ...prev, tauFactor: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-10 text-right">{tuneConfig.tauFactor.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24">bufferFactor</span>
              <input
                type="range"
                min={0.55}
                max={1.1}
                step={0.01}
                value={tuneConfig.bufferFactor}
                onChange={(e) => setTuneConfig((prev) => ({ ...prev, bufferFactor: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-10 text-right">{tuneConfig.bufferFactor.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24">minBuffer</span>
              <input
                type="range"
                min={240}
                max={900}
                step={10}
                value={tuneConfig.minBuffer}
                onChange={(e) => setTuneConfig((prev) => ({ ...prev, minBuffer: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-10 text-right">{tuneConfig.minBuffer}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24">jitterFactor</span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={tuneConfig.jitterFactor}
                onChange={(e) => setTuneConfig((prev) => ({ ...prev, jitterFactor: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-10 text-right">{tuneConfig.jitterFactor.toFixed(2)}</span>
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setTuneConfig({
                  tauFactor: TAU_FACTOR,
                  minLerpTau: MIN_LERP_TAU,
                  maxLerpTau: MAX_LERP_TAU,
                  minBuffer: MIN_STREAM_BUFFER_MS,
                  maxBuffer: MAX_STREAM_BUFFER_MS,
                  bufferFactor: STREAM_BUFFER_FACTOR,
                  jitterFactor: STREAM_JITTER_FACTOR,
                })
                holdFramesRef.current = 0
              }}
              className="rounded border border-amber-300/40 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-200 hover:bg-amber-300/10"
            >
              reset tune
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

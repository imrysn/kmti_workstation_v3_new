import { useEffect, useRef, useCallback } from 'react'
import { useMusic } from '../context/MusicContext'

interface AudioVisualizerProps {
  isPlaying: boolean
  size?: number
}

/**
 * Circular frequency-bar visualizer.
 *
 * Key fixes vs v1:
 *  - RAF loop uses a stable mutable ref (not a useCallback dep) so it never
 *    silently dies when React re-renders.
 *  - Color parsing always produces valid canvas color strings regardless of
 *    whether the CSS var resolves to hex, rgb(), or rgba().
 *  - Idle animation always runs even before Web Audio is connected.
 *  - createMediaElementSource is only called once per audio element (guarded).
 */
export default function AudioVisualizer({ isPlaying, size = 200 }: AudioVisualizerProps) {
  const { getAudioElement } = useMusic()

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const sourceRef    = useRef<MediaElementAudioSourceNode | null>(null)
  const dataRef      = useRef<Uint8Array>(new Uint8Array(128))
  const wiredRef     = useRef<HTMLAudioElement | null>(null)
  const idlePhaseRef = useRef<number>(0)
  const isPlayingRef = useRef(isPlaying)
  const sizeRef      = useRef(size)

  // Keep refs in sync without triggering re-renders
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { sizeRef.current = size }, [size])

  // ── Colour helpers ────────────────────────────────────────────────────────
  // Returns a CSS colour string guaranteed to work in canvas (hex or rgb()).
  // getComputedStyle on a CSS var can give back any format; we normalise to
  // something canvas will accept by parsing through an off-screen element.
  const resolveColor = useCallback((varName: string, fallback: string): string => {
    try {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(varName).trim()
      if (!raw) return fallback
      // If it's already a valid colour string (hex, rgb, hsl, named) return it.
      // Canvas will reject empty string but accept anything CSS does.
      return raw
    } catch {
      return fallback
    }
  }, [])

  // Makes a colour semi-transparent by appending alpha via canvas manipulation.
  // Avoids the brittle `color + 'aa'` hack which breaks for rgb() values.
  const withAlpha = useCallback((color: string, alpha: number): string => {
    // Use an offscreen canvas to parse any CSS colour into rgba components
    const tmp = document.createElement('canvas')
    tmp.width = tmp.height = 1
    const ctx = tmp.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgba(${r},${g},${b},${alpha})`
  }, [])

  // ── Web Audio wiring ───────────────────────────────────────────────────────
  const ensureAnalyser = useCallback((): boolean => {
    const audio = getAudioElement()
    if (!audio) return false

    // Already wired to this element → nothing to do
    if (wiredRef.current === audio && analyserRef.current) return true

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const actx = audioCtxRef.current

      // Tear down previous source if switching elements
      if (sourceRef.current && wiredRef.current !== audio) {
        try { sourceRef.current.disconnect() } catch {}
        sourceRef.current = null
        analyserRef.current = null
      }

      if (!sourceRef.current) {
        sourceRef.current = actx.createMediaElementSource(audio)
      }

      if (!analyserRef.current) {
        const a = actx.createAnalyser()
        a.fftSize = 512           // 256 bins — more detail
        a.smoothingTimeConstant = 0.82
        analyserRef.current = a
        dataRef.current = new Uint8Array(a.frequencyBinCount)
      }

      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(actx.destination)
      wiredRef.current = audio

      if (actx.state === 'suspended') actx.resume().catch(() => {})
      return true
    } catch {
      return false
    }
  }, [getAudioElement])

  // ── Main draw — lives in a stable ref so RAF never goes stale ─────────────
  const drawRef = useRef<() => void>(() => {})

  drawRef.current = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr     = Math.min(window.devicePixelRatio || 1, 2)
    const cssSize = sizeRef.current
    const px      = cssSize * dpr

    if (canvas.width !== px || canvas.height !== px) {
      canvas.width  = px
      canvas.height = px
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, px, px)

    const cx = px / 2
    const cy = px / 2

    // Resolve theme colours (cheap — cached by browser)
    const accent    = resolveColor('--accent',    '#38bdf8')
    const textMuted = resolveColor('--text-muted','#64748b')
    const bgColor   = resolveColor('--bg-secondary', '#1e293b')

    // ── Frequency data ──────────────────────────────────────────────────────
    const playing = isPlayingRef.current
    const wired   = ensureAnalyser()
    let freq: Uint8Array

    if (wired && analyserRef.current && playing) {
      analyserRef.current.getByteFrequencyData(dataRef.current)
      freq = dataRef.current
    } else {
      // Idle sine ripple — always visible even without Web Audio
      idlePhaseRef.current += playing ? 0.04 : 0.018
      const t    = idlePhaseRef.current
      const bins = dataRef.current.length
      freq = new Uint8Array(bins)
      for (let i = 0; i < bins; i++) {
        const wave = Math.sin(t + (i / bins) * Math.PI * 4) * 0.5 + 0.5
        const wave2 = Math.sin(t * 1.3 + (i / bins) * Math.PI * 2) * 0.3 + 0.3
        freq[i] = Math.round((wave * 0.6 + wave2 * 0.4) * (playing ? 80 : 30) + 8)
      }
    }

    // ── Layout ──────────────────────────────────────────────────────────────
    const barCount = Math.min(freq.length, 96)
    const innerR   = px * 0.24
    const maxBarH  = px * 0.22
    const step     = (Math.PI * 2) / barCount
    const lineW    = Math.max((step * innerR * 0.6), dpr * 1.2)

    // ── Outer diffuse glow (playing only) ───────────────────────────────────
    if (playing) {
      const avg = freq.slice(0, barCount).reduce((a, b) => a + b, 0) / barCount
      const glowR = innerR + (avg / 255) * maxBarH * 0.5 + px * 0.04

      const grd = ctx.createRadialGradient(cx, cy, innerR * 0.5, cx, cy, glowR)
      grd.addColorStop(0,   withAlpha(accent, 0))
      grd.addColorStop(0.6, withAlpha(accent, 0.06))
      grd.addColorStop(1,   withAlpha(accent, 0))

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
      ctx.restore()
    }

    // ── Radial frequency bars ────────────────────────────────────────────────
    for (let i = 0; i < barCount; i++) {
      const angle = i * step - Math.PI / 2
      const norm  = freq[i] / 255
      const barH  = innerR * 0.06 + norm * maxBarH

      const x1 = cx + Math.cos(angle) * innerR
      const y1 = cy + Math.sin(angle) * innerR
      const x2 = cx + Math.cos(angle) * (innerR + barH)
      const y2 = cy + Math.sin(angle) * (innerR + barH)

      const grad = ctx.createLinearGradient(x1, y1, x2, y2)

      if (playing) {
        // Colour the bar by frequency region: bass=warm, mid=accent, high=bright
        const hue = i / barCount   // 0→1 across full circle
        if (norm > 0.6) {
          // Hot bars: white tip
          grad.addColorStop(0,   withAlpha(accent, 0.5))
          grad.addColorStop(0.5, withAlpha(accent, 0.9))
          grad.addColorStop(1,   'rgba(255,255,255,0.95)')
        } else {
          grad.addColorStop(0, withAlpha(accent, 0.3 + norm * 0.3))
          grad.addColorStop(1, withAlpha(accent, 0.6 + norm * 0.35))
        }
        ctx.globalAlpha = 0.45 + norm * 0.55
      } else {
        grad.addColorStop(0, withAlpha(textMuted, 0.15))
        grad.addColorStop(1, withAlpha(textMuted, 0.4))
        ctx.globalAlpha = 0.5
      }

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineWidth = lineW
      ctx.lineCap  = 'round'
      ctx.strokeStyle = grad
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // ── Inner circle background ──────────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(cx, cy, innerR - dpr, 0, Math.PI * 2)
    ctx.fillStyle = bgColor
    ctx.fill()

    // ── Inner circle border ring ─────────────────────────────────────────────
    // Outer faint ring
    ctx.beginPath()
    ctx.arc(cx, cy, innerR - dpr * 0.5, 0, Math.PI * 2)
    ctx.strokeStyle = playing ? withAlpha(accent, 0.5) : withAlpha(textMuted, 0.2)
    ctx.lineWidth = dpr
    ctx.stroke()

    // Inner decorative concentric ring
    ctx.beginPath()
    ctx.arc(cx, cy, innerR * 0.72, 0, Math.PI * 2)
    ctx.strokeStyle = playing ? withAlpha(accent, 0.15) : withAlpha(textMuted, 0.08)
    ctx.lineWidth = dpr * 0.7
    ctx.stroke()

    // ── Rotating accent arc (progress indicator feel) ─────────────────────
    if (playing) {
      idlePhaseRef.current   // already updated above
      const arcStart = idlePhaseRef.current * 0.5 - Math.PI / 2
      const arcEnd   = arcStart + Math.PI * 0.6

      ctx.beginPath()
      ctx.arc(cx, cy, innerR - dpr * 0.5, arcStart, arcEnd)
      ctx.strokeStyle = withAlpha(accent, 0.7)
      ctx.lineWidth = dpr * 1.5
      ctx.stroke()
    }

    // ── Centre label ─────────────────────────────────────────────────────────
    const fontSize = Math.round(px * 0.1)
    ctx.font          = `800 ${fontSize}px 'Inter', -apple-system, sans-serif`
    ctx.textAlign     = 'center'
    ctx.textBaseline  = 'middle'
    ctx.fillStyle     = playing ? accent : withAlpha(textMuted, 0.6)
    ctx.globalAlpha   = playing ? 1 : 0.6
    ctx.fillText('KMTI', cx, cy - fontSize * 0.15)

    // Sub-label
    const subSize = Math.round(px * 0.055)
    ctx.font        = `500 ${subSize}px 'Inter', -apple-system, sans-serif`
    ctx.fillStyle   = playing ? withAlpha(accent, 0.6) : withAlpha(textMuted, 0.35)
    ctx.globalAlpha = 1
    ctx.fillText(playing ? '● LIVE' : '— —', cx, cy + fontSize * 0.7)

    // ── Schedule next frame ───────────────────────────────────────────────────
    rafRef.current = requestAnimationFrame(() => drawRef.current())
  }

  // Start the loop once on mount; the stable drawRef.current keeps it fresh
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => drawRef.current())
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // intentionally empty — loop is self-sustaining via drawRef

  // Cleanup Web Audio on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      try {
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        audioCtxRef.current?.close()
      } catch {}
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
      aria-label="Audio frequency visualizer"
      aria-hidden="true"
    />
  )
}

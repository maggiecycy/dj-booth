import { roundRect } from './characters'

export type WaveStyle = 'mirror' | 'dots' | 'ribbon' | 'neon' | 'off'

export const WAVE_STYLES: { id: WaveStyle; label: string }[] = [
  { id: 'mirror', label: 'Mirror bars' },
  { id: 'dots', label: 'Dots + lines' },
  { id: 'ribbon', label: 'Neon ribbon' },
  { id: 'neon', label: 'Glow pulse' },
  { id: 'off', label: 'Off' },
]

export interface WaveDrawState {
  spectrum: number[]
  waveform: number[]
  playing: boolean
  reducedMotion: boolean
  energy: number
  tint: [number, number, number]
  time: number
}

/** Full-width bottom wave strip — style switchable from the console. */
export function drawWaveVisualizer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: WaveStyle,
  state: WaveDrawState,
): void {
  if (style === 'off' || !state.spectrum.length) return

  // ~2× previous strip height so the wave reads clearly above the console
  const bandH = Math.min(140, h * 0.24)
  const midY = h - bandH * 0.48
  const damp = state.reducedMotion ? 0.4 : 1

  ctx.save()
  // Soft stage fade so waves sit in the pit, not on UI
  const fade = ctx.createLinearGradient(0, h - bandH - 48, 0, h)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.4, 'rgba(0,0,0,0.28)')
  fade.addColorStop(1, 'rgba(0,0,0,0.68)')
  ctx.fillStyle = fade
  ctx.fillRect(0, h - bandH - 48, w, bandH + 48)

  switch (style) {
    case 'mirror':
      drawMirrorBars(ctx, w, midY, bandH, state, damp)
      break
    case 'dots':
      drawDotsAndLines(ctx, w, midY, bandH, state, damp)
      break
    case 'ribbon':
      drawRibbon(ctx, w, midY, bandH, state, damp)
      break
    case 'neon':
      drawNeonPulse(ctx, w, midY, bandH, state, damp)
      break
  }
  ctx.restore()
}

function ampAt(spectrum: number[], i: number, n: number): number {
  // Symmetric: bass in the center, highs toward edges
  const t = i / Math.max(1, n - 1)
  const dist = Math.abs(t - 0.5) * 2
  const src = Math.min(spectrum.length - 1, Math.floor(dist * (spectrum.length - 0.01)))
  const neighbor = Math.min(spectrum.length - 1, src + 1)
  const frac = dist * (spectrum.length - 1) - src
  const v = (spectrum[src] ?? 0) * (1 - frac) + (spectrum[neighbor] ?? 0) * frac
  return Math.min(1, v * (1.15 - dist * 0.25))
}

function drawMirrorBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  midY: number,
  bandH: number,
  state: WaveDrawState,
  damp: number,
) {
  const n = Math.min(140, Math.max(64, state.spectrum.length * 2))
  const pad = w * 0.02
  const gap = 1
  const barW = Math.max(1.2, (w - pad * 2 - gap * (n - 1)) / n)
  const maxH = bandH * 0.48
  const [tr, tg, tb] = state.tint

  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < n; i++) {
    const v = ampAt(state.spectrum, i, n) * damp * (0.75 + state.energy * 0.45)
    const half = Math.max(1.5, v * maxH)
    const x = pad + i * (barW + gap)
    const grad = ctx.createLinearGradient(x, midY - half, x, midY + half)
    grad.addColorStop(0, `rgba(${tr},${tg},${tb},0)`)
    grad.addColorStop(0.35, `rgba(255,255,255,${0.15 + v * 0.55})`)
    grad.addColorStop(0.5, `rgba(${tr},${tg},${tb},${0.35 + v * 0.55})`)
    grad.addColorStop(0.65, `rgba(255,255,255,${0.15 + v * 0.55})`)
    grad.addColorStop(1, `rgba(${tr},${tg},${tb},0)`)
    ctx.fillStyle = grad
    roundRect(ctx, x, midY - half, barW, half * 2, Math.min(1.5, barW * 0.4))
    ctx.fill()
  }
}

function drawDotsAndLines(
  ctx: CanvasRenderingContext2D,
  w: number,
  midY: number,
  bandH: number,
  state: WaveDrawState,
  damp: number,
) {
  const n = 96
  const pad = w * 0.02
  const step = (w - pad * 2) / n
  const maxH = bandH * 0.46
  const cyan = [80, 220, 255] as const

  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < n; i++) {
    const v = ampAt(state.spectrum, i, n) * damp * (0.7 + state.energy * 0.5)
    const half = Math.max(2, v * maxH)
    const x = pad + i * step + step * 0.35
    const dots = Math.max(2, Math.floor(half / 3.2))
    for (let d = 0; d < dots; d++) {
      const t = d / Math.max(1, dots - 1)
      const yUp = midY - t * half
      const yDn = midY + t * half
      const a = 0.2 + (1 - t) * 0.55 * v
      ctx.fillStyle = `rgba(${cyan[0]},${cyan[1]},${cyan[2]},${a})`
      ctx.fillRect(x, yUp, 2, 2)
      ctx.fillRect(x, yDn, 2, 2)
    }
  }

  // Interwoven wave lines from time-domain
  const waves = state.waveform
  if (waves.length > 4) {
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath()
      const amp = maxH * (0.35 + layer * 0.12) * damp
      const phase = state.time * (1.2 + layer * 0.4) + layer
      for (let i = 0; i < waves.length; i++) {
        const t = i / (waves.length - 1)
        const x = pad + t * (w - pad * 2)
        const base = (waves[i] ?? 0) * amp
        const wobble = Math.sin(t * Math.PI * 6 + phase) * amp * 0.12
        const y = midY + base * (1 - layer * 0.15) + wobble
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(${cyan[0]},${cyan[1]},${cyan[2]},${0.22 + layer * 0.08})`
      ctx.lineWidth = 1 + layer * 0.3
      ctx.stroke()
    }
  }
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  w: number,
  midY: number,
  bandH: number,
  state: WaveDrawState,
  damp: number,
) {
  const waves = state.waveform
  if (waves.length < 8) return
  const maxH = bandH * 0.42 * damp
  const pad = w * 0.02
  const layers = state.reducedMotion ? 5 : 12

  ctx.globalCompositeOperation = 'lighter'
  for (let layer = 0; layer < layers; layer++) {
    const o = (layer / (layers - 1) - 0.5) * 10
    ctx.beginPath()
    for (let i = 0; i < waves.length; i++) {
      const t = i / (waves.length - 1)
      const x = pad + t * (w - pad * 2)
      const env = Math.sin(t * Math.PI) ** 0.7
      const spec = ampAt(state.spectrum, i, waves.length)
      const y =
        midY +
        ((waves[i] ?? 0) * maxH + Math.sin(t * 18 + state.time * 2 + layer * 0.2) * maxH * 0.08) *
          env *
          (0.55 + spec * 0.7) +
        o
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    const grad = ctx.createLinearGradient(0, midY - maxH, 0, midY + maxH)
    grad.addColorStop(0, 'rgba(255,80,200,0.55)')
    grad.addColorStop(0.5, 'rgba(120,220,255,0.45)')
    grad.addColorStop(1, 'rgba(80,180,255,0.55)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.1
    ctx.globalAlpha = 0.35 + (1 - Math.abs(layer / (layers - 1) - 0.5)) * 0.35
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawNeonPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  midY: number,
  bandH: number,
  state: WaveDrawState,
  damp: number,
) {
  const n = 110
  const pad = w * 0.02
  const step = (w - pad * 2) / n
  const maxH = bandH * 0.5
  const waves = state.waveform

  ctx.globalCompositeOperation = 'lighter'

  // Soft mirrored stalks
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const env = Math.sin(t * Math.PI) ** 1.1
    let v = ampAt(state.spectrum, i, n)
    if (waves.length) {
      const wi = Math.floor(t * (waves.length - 1))
      v = Math.min(1, v * 0.65 + Math.abs(waves[wi] ?? 0) * 0.55)
    }
    v *= env * damp * (0.7 + state.energy * 0.5)
    const half = Math.max(1, v * maxH)
    const x = pad + i * step
    const grad = ctx.createLinearGradient(x, midY - half, x, midY + half)
    grad.addColorStop(0, 'rgba(80,200,255,0)')
    grad.addColorStop(0.5, `rgba(100,220,255,${0.25 + v * 0.65})`)
    grad.addColorStop(1, 'rgba(80,200,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(x, midY - half, Math.max(1.2, step * 0.55), half * 2)
  }

  // Layered glow ribbons
  if (waves.length > 4) {
    for (let layer = 0; layer < 4; layer++) {
      ctx.beginPath()
      for (let i = 0; i < waves.length; i++) {
        const t = i / (waves.length - 1)
        const env = Math.sin(t * Math.PI) ** 0.85
        const x = pad + t * (w - pad * 2)
        const y =
          midY +
          (waves[i] ?? 0) * maxH * 0.55 * env * damp +
          Math.sin(t * 10 + state.time * 1.5 + layer) * 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(140,230,255,${0.18 + layer * 0.06})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
}

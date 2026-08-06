import type { MotionParams } from '../audio/analysis'
import type { CategoryId, Track, TrackMood } from '../audio/playlist'
import { sceneDanceStyle } from '../audio/playlist'
import { SITE } from '../config'
import {
  armsForStyle,
  buildKinetics,
  CROWD_LAYOUT,
  djAppearance,
  drawClubCharacter,
  roundRect,
  type DanceStyleId,
} from './characters'

export interface SceneState {
  motion: MotionParams
  track: Track | null
  playing: boolean
  transition: number
  reducedMotion: boolean
  boothCategory: CategoryId
}

const MOOD_TINT: Record<TrackMood, [number, number, number]> = {
  warm: [255, 140, 90],
  cool: [110, 180, 200],
  amber: [240, 170, 80],
  deep: [90, 140, 170],
  bright: [255, 200, 140],
  mist: [150, 175, 190],
}

/**
 * DJScene — Canvas 2D stage: atmosphere, decks, DJ character, lights.
 * Character is layered vector drawing so limbs can follow audio params.
 */
export class DJScene {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private w = 0
  private h = 0
  private vinylAngle = 0
  private breath = 0
  private armPhase = 0
  private scratch = 0
  private twoStep = 0

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D unavailable')
    this.canvas = canvas
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = cssWidth
    this.h = cssHeight
    this.canvas.width = Math.floor(cssWidth * this.dpr)
    this.canvas.height = Math.floor(cssHeight * this.dpr)
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  update(dt: number, state: SceneState): void {
    const { motion } = state
    this.breath += dt * (state.playing ? 1.2 : 0.6)
    this.vinylAngle += dt * motion.vinylSpeed * 2.8
    this.armPhase += dt * (2.2 + motion.armSwing * 4)
    // House two-step: weight shifts ~2× per bar feel when bass hits
    this.twoStep += dt * (state.playing ? 2.4 + motion.bounce * 3.2 : 0.8)
    if (state.transition > 0.05) {
      this.scratch += dt * 14
    }
  }

  draw(state: SceneState): void {
    const { ctx, w, h } = this
    ctx.clearRect(0, 0, w, h)

    const mood = state.track?.mood ?? 'deep'
    const tint = MOOD_TINT[mood]
    const pulse = state.motion.energyPulse
    const flash = state.motion.beatFlash

    this.drawAtmosphere(tint, pulse, flash, state.transition)
    this.drawVenue(tint, pulse)
    this.drawFloor(tint, pulse)
    this.drawBackLights(tint, pulse, flash)
    this.drawCrowd(state)
    this.drawBooth(tint, pulse)
    this.drawVinyl(tint, state)
    this.drawDJ(state)
    this.drawFrontLights(tint, pulse, flash)
    this.drawHaze(tint, pulse, flash)
    this.drawTitle()
    if (state.transition > 0.02) this.drawScratchFx(state.transition)
  }

  private drawAtmosphere(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    transition: number,
  ) {
    const { ctx, w, h } = this
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.35,
      20,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75,
    )
    const a = 0.32 + pulse * 0.28 + flash * 0.22
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`)
    g.addColorStop(0.35, `rgba(${Math.min(255, tint[0] + 40)},${Math.min(255, tint[1] + 20)},${tint[2]},${a * 0.45})`)
    g.addColorStop(0.55, `rgba(18, 28, 36, 0.65)`)
    g.addColorStop(1, `rgba(6, 10, 14, 0.95)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    // Soft vignette haze
    const haze = ctx.createLinearGradient(0, 0, 0, h)
    haze.addColorStop(0, 'rgba(8,14,20,0.35)')
    haze.addColorStop(0.5, 'rgba(8,14,20,0)')
    haze.addColorStop(1, 'rgba(4,8,12,0.55)')
    ctx.fillStyle = haze
    ctx.fillRect(0, 0, w, h)

    if (transition > 0) {
      ctx.fillStyle = `rgba(255,220,180,${transition * 0.12})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  /** Venue shell — truss, LED wall, side stacks (Fred again.. live scale) */
  private drawVenue(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const stageTop = h * 0.52

    // Arch / hall silhouette
    ctx.save()
    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.12 + pulse * 0.08})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w * 0.05, h * 0.72)
    ctx.quadraticCurveTo(w * 0.05, h * 0.08, cx, h * 0.04)
    ctx.quadraticCurveTo(w * 0.95, h * 0.08, w * 0.95, h * 0.72)
    ctx.stroke()
    ctx.restore()

    // Overhead truss
    ctx.fillStyle = '#0a0e14'
    roundRect(ctx, w * 0.08, h * 0.055, w * 0.84, 14, 4)
    ctx.fill()
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + pulse * 0.06})`
    ctx.lineWidth = 1
    roundRect(ctx, w * 0.08, h * 0.055, w * 0.84, 14, 4)
    ctx.stroke()

    // LED wall behind booth
    const wallW = Math.min(w * 0.55, 400)
    const wallH = h * 0.22
    const wallY = stageTop - wallH + 10
    const wg = ctx.createLinearGradient(cx - wallW / 2, wallY, cx + wallW / 2, wallY + wallH)
    wg.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.15 + pulse * 0.2})`)
    wg.addColorStop(0.5, `rgba(255,255,255,${0.08 + pulse * 0.12})`)
    wg.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.15 + pulse * 0.2})`)
    ctx.fillStyle = wg
    roundRect(ctx, cx - wallW / 2, wallY, wallW, wallH, 8)
    ctx.fill()
    ctx.strokeStyle = `rgba(255,255,255,0.1)`
    roundRect(ctx, cx - wallW / 2, wallY, wallW, wallH, 8)
    ctx.stroke()

    // Side speaker stacks
    for (const sx of [w * 0.06, w * 0.94]) {
      ctx.fillStyle = '#0c1018'
      roundRect(ctx, sx - 22, h * 0.38, 44, h * 0.28, 6)
      ctx.fill()
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.12 + pulse * 0.15})`
        ctx.beginPath()
        ctx.arc(sx, h * 0.42 + i * 28, 10 + (i % 2) * 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private drawFloor(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const y = h * 0.68
    const g = ctx.createLinearGradient(0, y, 0, h)
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.14 + pulse * 0.14})`)
    g.addColorStop(0.4, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.06 + pulse * 0.08})`)
    g.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, w, h - y)

    // Pit glow pool under crowd
    const pit = ctx.createRadialGradient(w * 0.5, h * 0.78, 10, w * 0.5, h * 0.78, w * 0.45)
    pit.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.12 + pulse * 0.18})`)
    pit.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = pit
    ctx.fillRect(0, y, w, h - y)

    ctx.strokeStyle = `rgba(255,255,255,${0.05 + pulse * 0.05})`
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      const yy = y + i * ((h - y) / 7)
      ctx.beginPath()
      ctx.moveTo(w * 0.04, yy)
      ctx.lineTo(w * 0.96, yy)
      ctx.stroke()
    }
  }

  private drawBooth(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const top = h * 0.54
    const bw = Math.min(w * 0.78, 560)
    const bh = h * 0.15

    // Stage riser
    ctx.fillStyle = '#0a0e14'
    roundRect(ctx, cx - bw / 2 - 20, top + bh - 8, bw + 40, h * 0.06, 6)
    ctx.fill()

    // Desk body
    ctx.fillStyle = '#121820'
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.fill()

    const glow = ctx.createLinearGradient(cx - bw / 2, top, cx + bw / 2, top + bh)
    glow.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`)
    glow.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.25 + pulse * 0.35})`)
    glow.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`)
    ctx.fillStyle = glow
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.fill()

    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.35 + pulse * 0.45})`
    ctx.lineWidth = 2
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.stroke()

    // CDJ units L/R
    for (const dx of [-bw * 0.28, bw * 0.28]) {
      ctx.fillStyle = '#0c1016'
      roundRect(ctx, cx + dx - 40, top + 14, 80, 52, 8)
      ctx.fill()
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse * 0.1})`
      roundRect(ctx, cx + dx - 40, top + 14, 80, 52, 8)
      ctx.stroke()
    }

    // Center mixer
    const mx = cx - 44
    const my = top + 16
    ctx.fillStyle = '#0c1016'
    roundRect(ctx, mx, my, 88, 50, 8)
    ctx.fill()

    for (let i = 0; i < 5; i++) {
      const px = mx + 14 + i * 14
      const press = Math.sin(this.armPhase + i) * 0.5 + 0.5
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.35 + press * pulse * 0.65})`
      ctx.beginPath()
      ctx.arc(px, my + 20, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    roundRect(ctx, cx - 10, my + 34, 20, 7, 3)
    ctx.fill()
  }

  private drawVinyl(tint: [number, number, number], state: SceneState) {
    const { ctx, w, h } = this
    const top = h * 0.54
    const y = top + h * 0.07
    const r = Math.min(54, w * 0.08)
    const positions = [w * 0.5 - Math.min(w * 0.28, 180), w * 0.5 + Math.min(w * 0.28, 180)]

    positions.forEach((x, i) => {
      const angle = this.vinylAngle * (i === 0 ? 1 : -0.85) + (state.transition > 0 ? this.scratch * (i === 0 ? 1 : -1) : 0)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)

      // Platter
      ctx.fillStyle = '#0a0d12'
      ctx.beginPath()
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#151b24'
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()

      // Grooves
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      for (let g = 8; g < r - 8; g += 5) {
        ctx.beginPath()
        ctx.arc(0, 0, g, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Label
      const lg = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.35)
      lg.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.85)`)
      lg.addColorStop(1, `rgba(${tint[0] * 0.5},${tint[1] * 0.5},${tint[2] * 0.5},0.9)`)
      ctx.fillStyle = lg
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#0a0d12'
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fill()

      // Strobe mark
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + state.motion.energyPulse * 0.3})`
      ctx.beginPath()
      ctx.moveTo(r * 0.35, 0)
      ctx.lineTo(r - 4, 0)
      ctx.stroke()

      ctx.restore()

      // Tonearm
      ctx.save()
      ctx.translate(x + r * 0.85, y - r * 0.9)
      ctx.rotate(0.7 + Math.sin(this.breath) * 0.03)
      ctx.strokeStyle = 'rgba(220,220,230,0.55)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-r * 0.9, r * 0.95)
      ctx.stroke()
      ctx.restore()
    })
  }

  private drawCrowd(state: SceneState) {
    const { ctx, w, h } = this
    const style = this.resolveStyle(state)
    const baseY = h * 0.54
    const cx = w * 0.5
    const sizeScale = Math.min(1, w / 420)

    for (const slot of CROWD_LAYOUT) {
      const k = buildKinetics(
        state.motion,
        this.twoStep + slot.phase * 0.1,
        this.armPhase + slot.phase * 0.08,
        this.breath,
      )
      const arms = armsForStyle(style, k)
      drawClubCharacter(
        ctx,
        cx + slot.xRatio * w,
        baseY + slot.yOff,
        slot.scale * sizeScale,
        k,
        arms,
        slot.appearance,
      )
    }
  }

  private resolveStyle(state: SceneState): DanceStyleId {
    return sceneDanceStyle(state.boothCategory, state.track)
  }

  private drawDJ(state: SceneState) {
    const { ctx, w, h } = this
    const style = this.resolveStyle(state)
    const k = buildKinetics(state.motion, this.twoStep, this.armPhase, this.breath)
    const arms = armsForStyle(style, k)
    const look = djAppearance(style)
    const cx = w * 0.5
    const baseY = h * 0.54
    const scale = Math.min(1, w / 420) * 1.08

    drawClubCharacter(ctx, cx, baseY, scale, k, arms, look)
  }

  /** Wash lights behind crowd */
  private drawBackLights(
    tint: [number, number, number],
    pulse: number,
    flash: number,
  ) {
    const { ctx, w, h } = this
    const beams = [
      { x: 0.12, spread: 0.22, warm: true },
      { x: 0.32, spread: 0.18, warm: false },
      { x: 0.5, spread: 0.24, warm: true },
      { x: 0.68, spread: 0.18, warm: false },
      { x: 0.88, spread: 0.22, warm: true },
    ]
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const b of beams) {
      const x = w * b.x
      const y = h * 0.06
      const a = 0.18 + pulse * 0.22 + flash * 0.28
      const [r, g, bCol] = b.warm ? tint : [tint[0] * 0.6, tint[1], tint[2] + 30]
      const rg = ctx.createRadialGradient(x, y, 4, x, y, h * 0.55)
      rg.addColorStop(0, `rgba(${r},${g},${bCol},${a * 1.2})`)
      rg.addColorStop(0.35, `rgba(${r},${g},${bCol},${a * 0.35})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - w * b.spread, h * 0.82)
      ctx.lineTo(x + w * b.spread, h * 0.82)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  /** Sharp beams + fixtures in front */
  private drawFrontLights(
    tint: [number, number, number],
    pulse: number,
    flash: number,
  ) {
    const { ctx, w, h } = this
    const spots = [
      [w * 0.1, h * 0.07],
      [w * 0.28, h * 0.04],
      [w * 0.5, h * 0.03],
      [w * 0.72, h * 0.04],
      [w * 0.9, h * 0.07],
    ] as const

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    spots.forEach(([x, y], i) => {
      const a = 0.22 + pulse * 0.28 + flash * 0.35 + Math.sin(this.breath + i) * 0.04
      const rg = ctx.createRadialGradient(x, y, 2, x, y, h * 0.5)
      rg.addColorStop(0, `rgba(255,255,255,${a * 0.55})`)
      rg.addColorStop(0.15, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`)
      rg.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 0.25})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - w * 0.2, h * 0.88)
      ctx.lineTo(x + w * 0.2, h * 0.88)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#1a222c'
      roundRect(ctx, x - 18, y - 8, 36, 12, 4)
      ctx.fill()
      ctx.fillStyle = `rgba(255,255,255,${0.5 + pulse * 0.5 + flash})`
      ctx.beginPath()
      ctx.arc(x, y + 2, 4, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()

    if (flash > 0.35) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.08})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  private drawHaze(
    tint: [number, number, number],
    pulse: number,
    flash: number,
  ) {
    const { ctx, w, h } = this
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const haze = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.85)
    haze.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.04 + pulse * 0.06})`)
    haze.addColorStop(0.5, `rgba(255,255,255,${0.03 + flash * 0.05})`)
    haze.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.08 + pulse * 0.1})`)
    ctx.fillStyle = haze
    ctx.fillRect(0, h * 0.35, w, h * 0.55)
    ctx.restore()
  }

  private drawTitle() {
    const { ctx, w, h } = this
    if (w < 360) return
    ctx.save()
    ctx.fillStyle = 'rgba(245,238,230,0.92)'
    ctx.font = `600 ${Math.min(42, w * 0.07)}px Syne, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(SITE.name, w * 0.06, h * 0.1)
    ctx.fillStyle = 'rgba(245,238,230,0.45)'
    ctx.font = `400 ${Math.min(14, w * 0.028)}px "DM Sans", system-ui, sans-serif`
    ctx.fillText(SITE.tagline, w * 0.06, h * 0.1 + 22)
    ctx.restore()
  }

  private drawScratchFx(amount: number) {
    const { ctx, w, h } = this
    ctx.save()
    ctx.globalAlpha = amount * 0.7
    ctx.strokeStyle = 'rgba(255,230,200,0.35)'
    ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const y = h * 0.35 + i * 18 + Math.sin(this.scratch + i) * 8
      ctx.beginPath()
      ctx.moveTo(w * 0.2, y)
      ctx.bezierCurveTo(
        w * 0.4,
        y + Math.sin(this.scratch * 2 + i) * 20,
        w * 0.6,
        y - Math.sin(this.scratch * 2 + i) * 20,
        w * 0.8,
        y,
      )
      ctx.stroke()
    }
    ctx.restore()
  }
}

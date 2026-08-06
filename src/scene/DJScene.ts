import type { MotionParams } from '../audio/analysis'
import type { Track, TrackMood } from '../audio/playlist'
import { SITE } from '../config'

export interface SceneState {
  motion: MotionParams
  track: Track | null
  playing: boolean
  transition: number
  reducedMotion: boolean
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
    this.drawFloor(tint, pulse)
    this.drawBooth(tint, pulse)
    this.drawVinyl(tint, state)
    this.drawDJ(state)
    this.drawLights(tint, pulse, flash)
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
    const a = 0.22 + pulse * 0.18 + flash * 0.12
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`)
    g.addColorStop(0.45, `rgba(18, 28, 36, 0.55)`)
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

  private drawFloor(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const y = h * 0.72
    const g = ctx.createLinearGradient(0, y, 0, h)
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.08 + pulse * 0.08})`)
    g.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, w, h - y)

    ctx.strokeStyle = `rgba(255,255,255,${0.04 + pulse * 0.04})`
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const yy = y + i * ((h - y) / 5)
      ctx.beginPath()
      ctx.moveTo(w * 0.1, yy)
      ctx.lineTo(w * 0.9, yy)
      ctx.stroke()
    }
  }

  private drawBooth(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const top = h * 0.58
    const bw = Math.min(w * 0.72, 520)
    const bh = h * 0.14

    // Desk body
    ctx.fillStyle = '#121820'
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.fill()

    // Desk edge glow
    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.25 + pulse * 0.35})`
    ctx.lineWidth = 2
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.stroke()

    // Mixer strip
    const mx = cx - 36
    const my = top + 18
    ctx.fillStyle = '#0c1016'
    roundRect(ctx, mx, my, 72, 48, 8)
    ctx.fill()

    for (let i = 0; i < 4; i++) {
      const px = mx + 12 + i * 14
      const press = Math.sin(this.armPhase + i) * 0.5 + 0.5
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.25 + press * pulse * 0.6})`
      ctx.beginPath()
      ctx.arc(px, my + 18, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Fader
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    roundRect(ctx, cx - 8, my + 30, 16, 6, 3)
    ctx.fill()
  }

  private drawVinyl(tint: [number, number, number], state: SceneState) {
    const { ctx, w, h } = this
    const top = h * 0.58
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

  private drawDJ(state: SceneState) {
    const { ctx, w, h } = this
    const m = state.motion
    const cx = w * 0.5
    const baseY = h * 0.58
    const scale = Math.min(1, w / 420) * 1.08

    // House / techno booth stance params
    const step = Math.sin(this.twoStep) // -1..1 weight shift
    const bounce = m.bounce * 10
    const breathY = Math.sin(this.breath) * 1.5
    const hipX = step * (6 + m.bounce * 8)
    const lean = 0.18 + m.energyPulse * 0.04 // forward lean toward decks
    const headNod = m.bounce * 0.08 + Math.sin(this.breath * 1.4) * 0.03

    // Cue / EQ hand motion (mid-high)
    const cue = Math.sin(this.armPhase) * (0.25 + m.armSwing * 0.55)
    const pad = m.padPress * 0.2
    const flashLift = m.beatFlash * 0.35

    ctx.save()
    ctx.translate(cx + hipX * 0.35, baseY - bounce - breathY)
    ctx.scale(scale, scale)
    ctx.rotate(hipX * 0.012)

    // Floor contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.beginPath()
    ctx.ellipse(0, 10, 52 + Math.abs(step) * 4, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    /*
     * Pose language (club floor / booth):
     * - Soft knees, wide stance (two-step weight transfer)
     * - Torso leans into the decks
     * - Free arm: shoulder bounce / occasional raise on flash
     * - Working arm: on mixer / platter (EQ twist)
     */
    const kneeBend = 0.42 + m.bounce * 0.25
    const leftWeight = 0.5 + step * 0.5
    const rightWeight = 1 - leftWeight

    // Legs — bent, grounded (draw behind torso)
    this.drawLeg(-18, -6, -0.22 - leftWeight * 0.08, kneeBend + leftWeight * 0.12, step > 0)
    this.drawLeg(18, -6, 0.22 + rightWeight * 0.08, kneeBend + rightWeight * 0.12, step < 0)

    // Hips / lower torso block
    ctx.save()
    ctx.translate(0, -28)
    ctx.rotate(lean * 0.35)
    ctx.fillStyle = '#1a222c'
    roundRect(ctx, -22, -8, 44, 24, 10)
    ctx.fill()
    ctx.restore()

    // Upper body — lean forward into booth
    ctx.save()
    ctx.translate(0, -36)
    ctx.rotate(lean)

    // Jacket torso
    const bodyGrad = ctx.createLinearGradient(0, -70, 0, 20)
    bodyGrad.addColorStop(0, '#3a4554')
    bodyGrad.addColorStop(0.55, '#252e3a')
    bodyGrad.addColorStop(1, '#151b24')
    ctx.fillStyle = bodyGrad
    roundRect(ctx, -26, -72, 52, 78, 16)
    ctx.fill()

    // Side stripe (club jacket detail)
    ctx.fillStyle = `rgba(232,164,106,${0.2 + m.energyPulse * 0.35})`
    roundRect(ctx, -26, -50, 5, 40, 2)
    ctx.fill()

    // Shoulders
    ctx.fillStyle = '#2c3644'
    ctx.beginPath()
    ctx.ellipse(-24, -62, 12, 9, -0.25, 0, Math.PI * 2)
    ctx.ellipse(24, -62, 12, 9, 0.25, 0, Math.PI * 2)
    ctx.fill()

    // Working arm (right): on mixer — EQ twist / pad press
    this.drawBoothArm(22, -58, {
      upper: 1.05 + cue * 0.15 + pad,
      fore: 0.85 - pad * 0.4,
      twist: cue * 0.5,
      hand: 'reach',
    })

    // Free arm (left): classic house bounce — elbow out, hand near chest / occasional raise
    this.drawBoothArm(-22, -58, {
      upper: -0.55 - flashLift + Math.sin(this.armPhase * 0.7) * 0.2 * m.armSwing,
      fore: -0.9 - m.bounce * 0.15,
      twist: -0.2,
      hand: 'groove',
    })

    // Neck
    ctx.fillStyle = '#c4a48a'
    roundRect(ctx, -6, -88, 12, 14, 4)
    ctx.fill()

    // Head — slight nod, looking down at decks
    ctx.save()
    ctx.translate(0, -98)
    ctx.rotate(headNod + lean * 0.4)

    // Headphones band
    ctx.strokeStyle = '#c8d0da'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.arc(0, -2, 22, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()

    // Head shape
    ctx.fillStyle = '#d4b39a'
    ctx.beginPath()
    ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2)
    ctx.fill()

    // Short textured hair
    ctx.fillStyle = '#141820'
    ctx.beginPath()
    ctx.ellipse(0, -10, 19, 12, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-14, -2, 7, 11, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(14, -2, 7, 11, 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Ear cups
    ctx.fillStyle = '#252b34'
    ctx.beginPath()
    ctx.ellipse(-22, 0, 7, 10, 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(22, 0, 7, 10, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(232,164,106,${0.35 + m.beatFlash * 0.55})`
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.ellipse(-22, 0, 7, 10, 0.15, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(22, 0, 7, 10, -0.15, 0, Math.PI * 2)
    ctx.stroke()

    // Focused eyes (looking down)
    ctx.strokeStyle = 'rgba(40,30,28,0.8)'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-8, 2)
    ctx.lineTo(-3, 3)
    ctx.moveTo(3, 3)
    ctx.lineTo(8, 2)
    ctx.stroke()

    // Soft mouth
    ctx.beginPath()
    ctx.moveTo(-3, 10)
    ctx.quadraticCurveTo(0, 12, 3, 10)
    ctx.stroke()

    ctx.restore() // head
    ctx.restore() // torso lean

    ctx.restore()
  }

  /** Bent-knee club stance leg */
  private drawLeg(
    x: number,
    y: number,
    hipAngle: number,
    kneeBend: number,
    lifted: boolean,
  ) {
    const { ctx } = this
    const lift = lifted ? -4 : 0
    ctx.save()
    ctx.translate(x, y + lift)
    ctx.rotate(hipAngle)

    // Thigh
    ctx.fillStyle = '#232b36'
    roundRect(ctx, -8, 0, 16, 28, 8)
    ctx.fill()

    // Shin — folds at knee
    ctx.translate(0, 26)
    ctx.rotate(kneeBend)
    ctx.fillStyle = '#1c232d'
    roundRect(ctx, -7, 0, 14, 26, 7)
    ctx.fill()

    // Shoe
    ctx.translate(0, 24)
    ctx.fillStyle = '#0e1218'
    roundRect(ctx, -9, 0, 20, 8, 3)
    ctx.fill()
    ctx.fillStyle = 'rgba(232,164,106,0.35)'
    roundRect(ctx, -9, 5, 20, 3, 1)
    ctx.fill()

    ctx.restore()
  }

  private drawBoothArm(
    x: number,
    y: number,
    pose: { upper: number; fore: number; twist: number; hand: 'reach' | 'groove' },
  ) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(pose.upper)

    // Upper arm
    ctx.strokeStyle = '#2a3340'
    ctx.lineWidth = 11
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 30)
    ctx.stroke()

    // Forearm
    ctx.translate(0, 30)
    ctx.rotate(pose.fore + pose.twist * 0.3)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 28)
    ctx.stroke()

    // Hand
    ctx.translate(0, 30)
    ctx.rotate(pose.twist)
    ctx.fillStyle = '#d4b39a'
    if (pose.hand === 'reach') {
      // Flat hand on deck / knob
      ctx.beginPath()
      ctx.ellipse(0, 2, 8, 5, 0.2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Loose fist / groove hand near chest
      ctx.beginPath()
      ctx.arc(0, 2, 6.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  private drawLights(
    tint: [number, number, number],
    pulse: number,
    flash: number,
  ) {
    const { ctx, w, h } = this
    const spots = [
      [w * 0.18, h * 0.12],
      [w * 0.5, h * 0.08],
      [w * 0.82, h * 0.12],
    ] as const

    spots.forEach(([x, y], i) => {
      const a = 0.08 + pulse * 0.12 + flash * 0.15 + Math.sin(this.breath + i) * 0.02
      const rg = ctx.createRadialGradient(x, y, 2, x, y, h * 0.45)
      rg.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 1.4})`)
      rg.addColorStop(0.4, `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 0.35})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - w * 0.18, h * 0.7)
      ctx.lineTo(x + w * 0.18, h * 0.7)
      ctx.closePath()
      ctx.fill()

      // Fixture
      ctx.fillStyle = '#1a222c'
      roundRect(ctx, x - 16, y - 6, 32, 10, 4)
      ctx.fill()
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.4 + pulse * 0.5 + flash})`
      ctx.beginPath()
      ctx.arc(x, y + 4, 3, 0, Math.PI * 2)
      ctx.fill()
    })
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

import type { MotionParams } from '../audio/analysis'
import type { CategoryId, Track, TrackMood } from '../audio/playlist'
import { sceneDanceStyle } from '../audio/playlist'
import { SITE } from '../config'
import {
  armsForStyle,
  armsForCrowd,
  buildKinetics,
  crowdRowAlpha,
  crowdRowLayout,
  CROWD_FRONT_SPLIT,
  CROWD_ROWS,
  CROWD_LAYOUT,
  djAppearance,
  drawClubCharacter,
  roundRect,
  type DanceStyleId,
} from './characters'

import { CheerSystem } from './cheers'
import { CrowdBubbleSystem } from './crowdBubbles'
import type { VenueSettings } from '../types/venue'
import { fxCurve, fxMix } from './venueFx'
import { ParticleSystem } from './particles'
import { PropFxSystem, type PropKind } from './propFx'
import { drawWaveVisualizer } from './waveVisualizer'

export interface SceneState {
  motion: MotionParams
  track: Track | null
  playing: boolean
  transition: number
  reducedMotion: boolean
  boothCategory: CategoryId
  venue: VenueSettings
  /** Frequency bars 0…1 */
  spectrum: number[]
  /** Time-domain samples −1…1 */
  waveform: number[]
}

const MOOD_TINT: Record<TrackMood, [number, number, number]> = {
  warm: [255, 140, 90],
  cool: [110, 180, 200],
  amber: [240, 170, 80],
  deep: [90, 140, 170],
  bright: [255, 200, 140],
  mist: [150, 175, 190],
}

/** Stage booth Y — lower on canvas, solid desk occludes DJ legs */
const BOOTH_TOP = 0.67

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
  private prevFlash = 0
  private co2Puff = 0
  private cheerFlash = 0
  private megaFlash = 0
  private waveTime = 0
  private particles = new ParticleSystem()
  private cheers = new CheerSystem()
  private bubbles = new CrowdBubbleSystem()
  private props = new PropFxSystem()

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
    this.particles.resize(cssWidth, cssHeight)
  }

  update(dt: number, state: SceneState): void {
    const { motion } = state
    this.breath += dt * (state.playing ? 1.2 : 0.6)
    this.waveTime += dt
    this.vinylAngle += dt * motion.vinylSpeed * 2.8
    this.armPhase += dt * (2.2 + motion.armSwing * 4)
    this.twoStep += dt * (state.playing ? 2.4 + motion.bounce * 3.2 : 0.8)
    if (state.transition > 0.05) {
      this.scratch += dt * 14
    }

    const pAmt = fxCurve(state.venue.particles)

    if (motion.beatFlash > 0.75 && this.prevFlash <= 0.75) {
      this.particles.burst(
        motion.beatFlash * Math.max(0.4, pAmt),
        this.w * 0.5,
        this.h * 0.46,
        Math.max(0.35, pAmt),
      )
      this.co2Puff = fxMix(1, state.venue.fog, motion.beatFlash)
    }
    if (state.playing) {
      this.particles.sprinkle(motion.energyPulse, Math.max(0.25, pAmt))
    }
    this.co2Puff = Math.max(0, this.co2Puff - dt * 1.8)
    this.cheerFlash = Math.max(0, this.cheerFlash - dt * 2.2)
    this.megaFlash = Math.max(0, this.megaFlash - dt * 1.4)
    this.prevFlash = motion.beatFlash
    this.particles.update(dt)
    this.cheers.update(dt)
    this.props.update(dt)

    this.bubbles.update(
      dt,
      state.playing,
      CROWD_LAYOUT,
      this.w * 0.5,
      this.h,
      this.w,
      Math.min(1.05, this.w / 420),
    )
  }

  /** Single tap — hype burst */
  triggerCheer(x: number, y: number, particleAmt = 0.9) {
    this.cheers.spawn(x, y, 1)
    this.particles.burst(0.85, x, y, particleAmt)
    this.co2Puff = Math.max(this.co2Puff, 0.55)
    this.cheerFlash = 1
  }

  /** Long-press drag trail */
  triggerDragTrail(x: number, y: number, particleAmt = 0.9) {
    this.particles.trail(x, y, 0.45 + particleAmt * 0.35)
    if (Math.random() < 0.22) {
      this.cheers.spawn(x, y, 0.35)
    }
    this.cheerFlash = Math.max(this.cheerFlash, 0.45)
    this.co2Puff = Math.max(this.co2Puff, 0.25)
  }

  /** Side-rail club prop toss — distinct per kind, never a mega burst */
  triggerProp(kind: PropKind, side: 'left' | 'right', particleAmt = 0.9) {
    if (this.w < 8 || this.h < 8) return
    this.props.spawn(kind, side, this.w, this.h)
    const x = side === 'left' ? this.w * 0.18 : this.w * 0.82
    const y = this.h * 0.4
    // Light accent only — do not screenFill / megaFlash
    if (kind === 'confetti' || kind === 'disco' || kind === 'cash') {
      this.particles.burst(0.55, x, y, Math.max(0.35, particleAmt * 0.55))
    }
    if (kind === 'bass' || kind === 'champagne' || kind === 'can' || kind === 'horn') {
      this.co2Puff = Math.max(this.co2Puff, 0.45)
      this.cheerFlash = Math.max(this.cheerFlash, 0.4)
    }
    if (kind === 'lighter' || kind === 'mic' || kind === 'ball') {
      this.cheerFlash = Math.max(this.cheerFlash, 0.35)
    }
  }

  /** 4+ rapid taps — full-stage overload */
  triggerMegaBurst(x: number, y: number, particleAmt = 0.9) {
    const amt = Math.max(0.6, particleAmt)
    this.cheers.spawn(x, y, 2.8)
    this.particles.burst(1, x, y, amt * 1.6)
    this.particles.screenFill(0.95, amt * 1.4)
    for (let i = 0; i < 6; i++) {
      this.particles.burst(
        0.85,
        this.w * (0.08 + Math.random() * 0.84),
        this.h * (0.12 + Math.random() * 0.62),
        amt,
      )
    }
    this.co2Puff = 1
    this.cheerFlash = 1
    this.megaFlash = 1
    for (let i = 0; i < 5; i++) {
      this.bubbles.spawnUser(
        ['🔥🔥🔥', 'LFG!!!', 'MAX!!!', 'GO!!!', '★★★'][i],
        CROWD_LAYOUT,
        this.w * 0.5,
        this.h,
        this.w,
        Math.min(1.05, this.w / 420),
      )
    }
  }

  /** User mood — bubble from a random raver's head */
  triggerMood(text: string) {
    this.bubbles.spawnUser(
      text,
      CROWD_LAYOUT,
      this.w * 0.5,
      this.h,
      this.w,
      Math.min(1.05, this.w / 420),
    )
  }

  private boothTopY(): number {
    return this.h * BOOTH_TOP
  }

  draw(state: SceneState): void {
    const { ctx, w, h } = this
    ctx.clearRect(0, 0, w, h)

    const mood = state.track?.mood ?? 'deep'
    const tint = MOOD_TINT[mood]
    const pulse = state.motion.energyPulse
    const flash = state.motion.beatFlash
    const v = state.venue
    const lightMul = fxCurve(v.lights)

    this.drawAtmosphere(tint, pulse, flash, state.transition, v)
    this.drawVenue(tint, pulse, flash, lightMul)
    this.drawStageDetails(tint, pulse, flash, lightMul)
    this.drawFloor(tint, pulse, lightMul)
    this.drawBackLights(tint, pulse, flash, lightMul)
    this.drawCrowd(state, 'behind')
    this.drawCrowd(state, 'front')
    this.drawDJ(state)
    this.drawBooth(tint, pulse)
    this.drawVinyl(tint, state)
    this.drawCo2(state, v)
    this.drawFrontLights(tint, pulse, flash, lightMul)
    this.drawLasers(tint, pulse, flash, state.playing, fxCurve(v.lasers))
    this.particles.draw(ctx)
    this.cheers.draw(ctx)
    this.bubbles.draw(ctx)
    this.drawHaze(tint, pulse, flash, v)
    if (this.megaFlash > 0.05) {
      ctx.fillStyle = `rgba(255,240,220,${this.megaFlash * 0.22})`
      ctx.fillRect(0, 0, w, h)
    }
    drawWaveVisualizer(ctx, w, h, v.wave, {
      spectrum: state.spectrum,
      waveform: state.waveform,
      playing: state.playing,
      reducedMotion: state.reducedMotion,
      energy: pulse,
      tint,
      time: this.waveTime,
    })
    // Props above haze / wave so side-rail tosses stay visible
    this.props.draw(ctx)
    this.drawTitle()
    if (state.transition > 0.02) this.drawScratchFx(state.transition)
  }

  private drawAtmosphere(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    transition: number,
    venue: VenueSettings,
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
    const a = fxMix(0.32 + pulse * 0.28 + flash * 0.22, venue.lights, flash)
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
  private drawVenue(tint: [number, number, number], pulse: number, flash: number, lightMul: number) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const stageTop = this.boothTopY()

    // Arch / hall silhouette
    ctx.save()
    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.12 + pulse * 0.08) * lightMul})`
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

    // Festoon bulbs along truss
    const bulbCount = 14
    for (let i = 0; i < bulbCount; i++) {
      const t = i / (bulbCount - 1)
      const bx = w * 0.1 + t * w * 0.8
      const glow = (0.35 + pulse * 0.35 + (i % 3 === 0 ? flash * 0.4 : 0)) * lightMul
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${glow})`
      ctx.beginPath()
      ctx.arc(bx, h * 0.075, 3 + (i % 2), 0, Math.PI * 2)
      ctx.fill()
    }
    // Side LED columns
    for (const sx of [w * 0.04, w * 0.96]) {
      const colW = 18
      for (let i = 0; i < 8; i++) {
        const yy = h * 0.22 + i * (h * 0.055)
        const on = Math.sin(this.breath * 2 + i * 0.7) * 0.5 + 0.5
        ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.15 + on * pulse * 0.35) * lightMul})`
        roundRect(ctx, sx - colW / 2, yy, colW, 8, 3)
        ctx.fill()
      }
    }
  }

  /** Extra festival hardware — barriers, drapes, cans, pixel bars */
  private drawStageDetails(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    lightMul: number,
  ) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const boothTop = this.boothTopY()

    // Side velvet drapes
    for (const side of [-1, 1]) {
      const x = side < 0 ? w * 0.02 : w * 0.86
      const dw = w * 0.14
      const dg = ctx.createLinearGradient(x, h * 0.12, x + dw * side, h * 0.12)
      dg.addColorStop(0, 'rgba(12,16,22,0.85)')
      dg.addColorStop(0.5, `rgba(${tint[0] * 0.15},${tint[1] * 0.15},${tint[2] * 0.15},0.55)`)
      dg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = dg
      ctx.fillRect(side < 0 ? x : x, h * 0.1, dw, h * 0.62)
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + pulse * 0.04})`
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.moveTo(x + (side < 0 ? dw * 0.2 : 0), h * 0.12 + i * (h * 0.09))
        ctx.lineTo(x + (side < 0 ? dw : dw * 0.8), h * 0.16 + i * (h * 0.09))
        ctx.stroke()
      }
    }

    // Truss moving heads
    const heads = [0.18, 0.32, 0.5, 0.68, 0.82]
    for (let i = 0; i < heads.length; i++) {
      const hx = w * heads[i]
      const hy = h * 0.09
      const sway = Math.sin(this.breath * 1.4 + i * 0.9) * 0.08
      ctx.strokeStyle = 'rgba(80,90,100,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(hx, h * 0.07)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      ctx.fillStyle = '#141820'
      ctx.beginPath()
      ctx.arc(hx, hy, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.35 + pulse * 0.4) * lightMul})`
      ctx.beginPath()
      ctx.arc(hx, hy + 2, 2.5, 0, Math.PI * 2)
      ctx.fill()
      const beamEndX = hx + Math.sin(sway + i) * w * 0.12
      const beamEndY = h * 0.72
      const bg = ctx.createLinearGradient(hx, hy, beamEndX, beamEndY)
      bg.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.12 * lightMul})`)
      bg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.moveTo(hx - 3, hy)
      ctx.lineTo(hx + 3, hy)
      ctx.lineTo(beamEndX + 14, beamEndY)
      ctx.lineTo(beamEndX - 14, beamEndY)
      ctx.closePath()
      ctx.fill()
    }

    // Front crowd barrier + pixel bar
    const railY = boothTop + h * 0.14
    ctx.strokeStyle = `rgba(200,210,220,${0.35 + pulse * 0.2})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w * 0.08, railY)
    ctx.lineTo(w * 0.92, railY)
    ctx.stroke()
    for (let i = 0; i < 22; i++) {
      const px = w * 0.08 + (i / 21) * w * 0.84
      ctx.strokeStyle = 'rgba(160,170,180,0.25)'
      ctx.beginPath()
      ctx.moveTo(px, railY)
      ctx.lineTo(px, railY + h * 0.045)
      ctx.stroke()
      const on = Math.sin(this.breath * 3 + i * 0.5) * 0.5 + 0.5
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.2 + on * pulse * 0.5 + flash * 0.3) * lightMul})`
      ctx.fillRect(px - 4, railY + h * 0.048, 8, 5)
    }

    // Stage wedge monitors beside booth
    for (const dx of [-1, 1]) {
      const wx = cx + dx * Math.min(w * 0.34, 160)
      const wy = boothTop + h * 0.11
      ctx.fillStyle = '#0c1016'
      ctx.beginPath()
      ctx.moveTo(wx, wy)
      ctx.lineTo(wx + dx * 28, wy + 18)
      ctx.lineTo(wx + dx * 10, wy + 22)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.25 + pulse * 0.35})`
      ctx.beginPath()
      ctx.arc(wx + dx * 14, wy + 12, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // CO2 / confetti cannons at stage corners
    for (const sx of [w * 0.14, w * 0.86]) {
      ctx.fillStyle = '#121820'
      roundRect(ctx, sx - 8, boothTop + h * 0.02, 16, h * 0.055, 4)
      ctx.fill()
      if (this.co2Puff > 0.1 || flash > 0.4) {
        const puff = ctx.createRadialGradient(sx, boothTop, 2, sx, boothTop - h * 0.08, 40)
        puff.addColorStop(0, `rgba(255,255,255,${this.co2Puff * 0.35})`)
        puff.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = puff
        ctx.beginPath()
        ctx.arc(sx, boothTop - h * 0.04, 36, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Overhead cable runs
    ctx.strokeStyle = `rgba(60,70,80,${0.25 + pulse * 0.1})`
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(w * 0.1 + i * w * 0.04, h * 0.07)
      ctx.quadraticCurveTo(cx, h * 0.14 + i * 8, w * 0.9 - i * w * 0.04, h * 0.07)
      ctx.stroke()
    }

    // Back wall vertical light blades
    for (let i = 0; i < 7; i++) {
      const lx = w * 0.22 + (i / 6) * w * 0.56
      const on = Math.sin(this.breath * 2.5 + i * 0.8) * 0.5 + 0.5
      const lg = ctx.createLinearGradient(lx, boothTop - h * 0.2, lx, boothTop)
      lg.addColorStop(0, 'rgba(0,0,0,0)')
      lg.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.08 + on * pulse * 0.2) * lightMul})`)
      lg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = lg
      ctx.fillRect(lx - 6, boothTop - h * 0.2, 12, h * 0.2)
    }

    // Main stage deck platform
    const deckW = Math.min(w * 0.88, 640)
    ctx.fillStyle = '#0a0e14'
    roundRect(ctx, cx - deckW / 2, boothTop - h * 0.04, deckW, h * 0.2, 10)
    ctx.fill()
    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.2 + pulse * 0.25})`
    ctx.lineWidth = 1.5
    roundRect(ctx, cx - deckW / 2, boothTop - h * 0.04, deckW, h * 0.2, 10)
    ctx.stroke()

    // Side banner flags
    for (const side of [-1, 1]) {
      const bx = cx + side * (deckW / 2 + 24)
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.12 + pulse * 0.15})`
      ctx.beginPath()
      ctx.moveTo(bx, h * 0.18)
      ctx.lineTo(bx + side * 28, h * 0.22)
      ctx.lineTo(bx + side * 28, h * 0.42)
      ctx.lineTo(bx, h * 0.38)
      ctx.closePath()
      ctx.fill()
    }

    // Floor haze vents
    for (let i = 0; i < 5; i++) {
      const vx = w * 0.15 + i * w * 0.17
      ctx.fillStyle = '#101820'
      roundRect(ctx, vx - 12, h * 0.78, 24, 8, 3)
      ctx.fill()
      if (pulse > 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.04 + pulse * 0.06})`
        ctx.beginPath()
        ctx.ellipse(vx, h * 0.76, 10 + pulse * 8, 4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Back wall LED ticker dots
    const tickerY = boothTop - h * 0.24
    for (let i = 0; i < 40; i++) {
      const tx = w * 0.12 + (i / 39) * w * 0.76
      const on = Math.sin(this.breath * 4 + i * 0.35) * 0.5 + 0.5
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.15 + on * 0.35) * lightMul})`
      ctx.fillRect(tx, tickerY, 3, 3)
    }

    // Crowd tier step lines (visual depth cues)
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + pulse * 0.03})`
    ctx.lineWidth = 1
    for (let tier = 0; tier < 5; tier++) {
      const ty = h * (0.38 + tier * 0.1)
      ctx.beginPath()
      ctx.moveTo(w * 0.06, ty)
      ctx.lineTo(w * 0.94, ty)
      ctx.stroke()
    }
  }

  private drawFloor(tint: [number, number, number], pulse: number, lightMul: number) {
    const { ctx, w, h } = this
    const y = h * 0.82
    const g = ctx.createLinearGradient(0, y, 0, h)
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.14 + pulse * 0.14) * lightMul})`)
    g.addColorStop(0.4, `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.06 + pulse * 0.08) * lightMul})`)
    g.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, w, h - y)

    // Pit glow pool under crowd
    const pit = ctx.createRadialGradient(w * 0.5, h * 0.88, 10, w * 0.5, h * 0.88, w * 0.4)
    pit.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.12 + pulse * 0.18) * lightMul})`)
    pit.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = pit
    ctx.fillRect(0, y, w, h - y)

    ctx.strokeStyle = `rgba(255,255,255,${0.05 + pulse * 0.05})`
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const yy = y + i * ((h - y) / 4)
      ctx.beginPath()
      ctx.moveTo(w * 0.04, yy)
      ctx.lineTo(w * 0.96, yy)
      ctx.stroke()
    }
  }

  private drawBooth(tint: [number, number, number], pulse: number) {
    const { ctx, w, h } = this
    const cx = w * 0.5
    const top = this.boothTopY()
    const bw = Math.min(w * 0.78, 560)
    const bh = h * 0.15

    // Stage riser — solid
    ctx.fillStyle = '#080c12'
    roundRect(ctx, cx - bw / 2 - 20, top + bh - 8, bw + 40, h * 0.06, 6)
    ctx.fill()

    // Desk body — opaque
    ctx.fillStyle = '#0e141c'
    roundRect(ctx, cx - bw / 2, top, bw, bh, 14)
    ctx.fill()

    // Front edge accent only (not full-surface glow)
    const edge = ctx.createLinearGradient(cx - bw / 2, top + bh - 6, cx + bw / 2, top + bh)
    edge.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.15)`)
    edge.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},${0.45 + pulse * 0.35})`)
    edge.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0.15)`)
    ctx.fillStyle = edge
    ctx.fillRect(cx - bw / 2, top + bh - 8, bw, 8)

    ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.55 + pulse * 0.35})`
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
    const top = this.boothTopY()
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

  private drawCrowd(state: SceneState, pass: 'behind' | 'front') {
    const { ctx, w, h } = this
    const style = this.resolveStyle(state)
    const cx = w * 0.5
    const sizeScale = Math.min(1.05, w / 420)

    for (let row = 0; row < CROWD_ROWS; row++) {
      const isFront = row >= CROWD_FRONT_SPLIT
      if (pass === 'behind' ? isFront : !isFront) continue

      const layout = crowdRowLayout(row)
      const rowFeetY = h * layout.feetYFrac
      this.drawRowDepthBand(rowFeetY, row)

      for (const slot of CROWD_LAYOUT) {
        if (slot.row !== row) continue

        const k0 = buildKinetics(
          state.motion,
          this.twoStep + slot.phase * 0.1,
          this.armPhase + slot.phase * 0.08,
          this.breath,
        )
        const rowDamp = 0.2 + slot.row * 0.08
        const k = {
          ...k0,
          bounce: k0.bounce * rowDamp,
          breathY: k0.breathY * rowDamp,
          hipX: k0.hipX * rowDamp,
        }
        const arms = armsForCrowd(
          style,
          k,
          this.armPhase + slot.phase,
          slot.wave,
        )
        const alpha = crowdRowAlpha(slot.row)
        const scale = slot.scale * sizeScale

        ctx.save()
        ctx.globalAlpha = alpha
        drawClubCharacter(
          ctx,
          cx + slot.xRatio * w,
          rowFeetY,
          scale,
          k,
          arms,
          slot.appearance,
        )
        ctx.restore()
      }
    }
  }

  /** Subtle shadow strip under each tier */
  private drawRowDepthBand(feetY: number, row: number) {
    const { ctx, w, h } = this
    const t = row / (CROWD_ROWS - 1)
    ctx.save()
    const bandTop = feetY - h * 0.012
    const g = ctx.createLinearGradient(0, bandTop, 0, feetY + h * 0.04)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, `rgba(0,0,0,${0.14 + t * 0.2})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, bandTop, w, h * 0.05)
    ctx.restore()
  }

  private resolveStyle(state: SceneState): DanceStyleId {
    return sceneDanceStyle(state.boothCategory, state.track)
  }

  private drawDJ(state: SceneState) {
    const { ctx, w, h } = this
    const style = this.resolveStyle(state)
    const k = buildKinetics(state.motion, this.twoStep, this.armPhase, this.breath)
    const cx = w * 0.5
    const boothTop = this.boothTopY()

    const spot = ctx.createRadialGradient(cx, boothTop - 60, 10, cx, boothTop, h * 0.32)
    spot.addColorStop(0, `rgba(255,255,255,${0.16 + this.cheerFlash * 0.2})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spot
    ctx.fillRect(cx - w * 0.3, boothTop - h * 0.28, w * 0.6, h * 0.42)

    const arms = armsForStyle(style, k)
    const look = djAppearance(style)
    const baseY = boothTop + 48
    const scale = Math.min(1.15, w / 380) * 1.05
    drawClubCharacter(ctx, cx, baseY, scale, k, arms, look)
  }

  /** Wash lights behind crowd */
  private drawBackLights(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    lightMul: number,
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
      const a = fxMix(0.2 + pulse * 0.26 + flash * 0.32, lightMul / 3, flash)
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
    lightMul: number,
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
    spots.forEach(([x, y], idx) => {
      const a =
        fxMix(0.24 + pulse * 0.32 + flash * 0.4, lightMul / 3, flash) +
        Math.sin(this.breath + idx) * 0.04
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

  /** Beat-synced laser sweeps across the room */
  private drawLasers(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    playing: boolean,
    laserMul: number,
  ) {
    if ((!playing && flash < 0.15) || laserMul < 0.03) return
    const { ctx, w, h } = this
    const lasers = 3 + Math.floor(laserMul * 8)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < lasers; i++) {
      const phase = this.breath * (1.6 + i * 0.12) + i * 1.1
      const x0 = w * (0.04 + (i / Math.max(1, lasers - 1)) * 0.92)
      const x1 = x0 + Math.sin(phase) * w * (0.28 + laserMul * 0.28)
      const a = fxMix(0.18 + pulse * 0.22 + flash * 0.55, laserMul / 2.2, flash)
      const [r, g, b] = i % 2 === 0 ? tint : [tint[2], tint[0] * 0.7, tint[1]]
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(1, a)})`
      ctx.lineWidth = 1.4 + flash * 3.5 + laserMul * 3.5
      ctx.beginPath()
      ctx.moveTo(x0, h * 0.02)
      ctx.lineTo(x1, h * 0.92)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawHaze(
    tint: [number, number, number],
    pulse: number,
    flash: number,
    venue: VenueSettings,
  ) {
    const { ctx, w, h } = this
    const hazeAmt = fxCurve(venue.haze)
    const fogAmt = fxCurve(venue.fog)
    if (hazeAmt < 0.02 && fogAmt < 0.02) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const haze = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.92)
    haze.addColorStop(
      0,
      `rgba(${tint[0]},${tint[1]},${tint[2]},${fxMix(0.12 + pulse * 0.18, venue.haze, flash)})`,
    )
    haze.addColorStop(
      0.45,
      `rgba(255,255,255,${fxMix(0.1 + flash * 0.22, venue.haze, flash)})`,
    )
    haze.addColorStop(
      1,
      `rgba(${tint[0]},${tint[1]},${tint[2]},${fxMix(0.18 + pulse * 0.22, venue.fog, flash)})`,
    )
    ctx.fillStyle = haze
    ctx.fillRect(0, h * 0.28, w, h * 0.65)

    if (this.co2Puff > 0.03 && fogAmt > 0.05) {
      for (const sx of [w * 0.18, w * 0.5, w * 0.82]) {
        const rad = w * (0.18 + fogAmt * 0.12)
        const rg = ctx.createRadialGradient(sx, h * 0.68, 4, sx, h * 0.68, rad)
        rg.addColorStop(0, `rgba(255,255,255,${this.co2Puff * 0.55 * fogAmt})`)
        rg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = rg
        ctx.fillRect(sx - rad, h * 0.48, rad * 2, h * 0.45)
      }
    }
    ctx.restore()
  }

  /** CO2 cannons at booth sides — puff on beat */
  private drawCo2(_state: SceneState, venue: VenueSettings) {
    const fog = fxCurve(venue.fog)
    if (this.co2Puff < 0.03 || fog < 0.05) return
    const { ctx, w, h } = this
    const a = this.co2Puff * fog * 1.35
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const sx of [w * 0.28, w * 0.72]) {
      const g = ctx.createRadialGradient(sx, h * 0.58, 2, sx, h * 0.68, 70 + fog * 40)
      g.addColorStop(0, `rgba(255,255,255,${a * 0.65})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, h * 0.62, 55 + fog * 25, 0, Math.PI * 2)
      ctx.fill()
    }
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

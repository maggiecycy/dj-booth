import type { CategoryId } from '../audio/playlist'
import type { MotionParams } from '../audio/analysis'

export type DanceStyleId = CategoryId | 'mix'

export interface CharacterAppearance {
  skin: string
  hair: string
  top: string
  topAccent: string
  pants: string
  shoeAccent: string
  expression: 'focus' | 'smile' | 'closed' | 'wide' | 'cool'
  hairStyle: 'short' | 'long' | 'bun' | 'cap' | 'curly'
  hasHeadphones?: boolean
}

export interface DanceKinetics {
  step: number
  bounce: number
  breathY: number
  hipX: number
  lean: number
  headNod: number
  cue: number
  pad: number
  flashLift: number
  kneeBend: number
  leftWeight: number
  rightWeight: number
}

export interface ArmPose {
  upper: number
  fore: number
  twist: number
  hand: 'reach' | 'groove' | 'up' | 'heart' | 'wave'
}

export interface StyleArms {
  left: ArmPose
  right: ArmPose
  lean: number
  stance: number
  headTilt: number
}

/** Shared motion math from scene timing + analyser motion */
export function buildKinetics(
  motion: MotionParams,
  twoStep: number,
  armPhase: number,
  breath: number,
): DanceKinetics {
  const step = Math.sin(twoStep)
  const bounce = motion.bounce * 10
  const breathY = Math.sin(breath) * 1.5
  const hipX = step * (6 + motion.bounce * 8)
  const lean = 0.18 + motion.energyPulse * 0.04
  const headNod = motion.bounce * 0.08 + Math.sin(breath * 1.4) * 0.03
  const cue = Math.sin(armPhase) * (0.25 + motion.armSwing * 0.55)
  const pad = motion.padPress * 0.2
  const flashLift = motion.beatFlash * 0.35
  const kneeBend = 0.42 + motion.bounce * 0.25
  const leftWeight = 0.5 + step * 0.5
  const rightWeight = 1 - leftWeight
  return {
    step,
    bounce,
    breathY,
    hipX,
    lean,
    headNod,
    cue,
    pad,
    flashLift,
    kneeBend,
    leftWeight,
    rightWeight,
  }
}

/** Per-genre arm / lean language — same kinetics, different silhouette */
export function armsForStyle(style: DanceStyleId, k: DanceKinetics): StyleArms {
  const { cue, pad, flashLift, lean, headNod } = k
  const swing = Math.sin(k.step * 2) * 0.15

  switch (style) {
    case 'house':
      return {
        lean,
        stance: 1,
        headTilt: headNod + lean * 0.4,
        left: {
          upper: -0.55 - flashLift + swing,
          fore: -0.9,
          twist: -0.2,
          hand: 'groove',
        },
        right: {
          upper: 1.05 + cue * 0.15 + pad,
          fore: 0.85 - pad * 0.4,
          twist: cue * 0.5,
          hand: 'reach',
        },
      }
    case 'techno':
      return {
        lean: lean * 1.35,
        stance: 0.85,
        headTilt: headNod + 0.15,
        left: {
          upper: 0.95 + cue * 0.1,
          fore: 0.7,
          twist: 0.3,
          hand: 'reach',
        },
        right: {
          upper: 1.15 + pad * 0.2,
          fore: 0.65,
          twist: -cue * 0.3,
          hand: 'reach',
        },
      }
    case 'melodic':
      return {
        lean: lean * 0.7,
        stance: 1.1,
        headTilt: headNod - 0.08,
        left: {
          upper: -0.35 - flashLift * 0.5,
          fore: -1.1,
          twist: -0.35,
          hand: 'groove',
        },
        right: {
          upper: -0.25 + swing,
          fore: -1.0,
          twist: 0.2,
          hand: 'heart',
        },
      }
    case 'deep':
      return {
        lean: lean * 0.55,
        stance: 1.15,
        headTilt: headNod * 0.6,
        left: {
          upper: -0.75,
          fore: -0.55,
          twist: -0.1,
          hand: 'groove',
        },
        right: {
          upper: 0.75 + cue * 0.08,
          fore: 0.55,
          twist: 0.15,
          hand: 'reach',
        },
      }
    case 'trance':
      return {
        lean: lean * 0.5,
        stance: 1,
        headTilt: -0.12 - flashLift * 0.2,
        left: {
          upper: -1.35 - flashLift,
          fore: -0.45,
          twist: -0.15,
          hand: 'up',
        },
        right: {
          upper: -1.25 - flashLift * 0.8,
          fore: -0.5,
          twist: 0.15,
          hand: 'up',
        },
      }
    case 'dnb':
      return {
        lean: lean * 1.1,
        stance: 0.75,
        headTilt: headNod + swing,
        left: {
          upper: -0.9 - cue * 0.4,
          fore: -0.7,
          twist: -0.3,
          hand: 'groove',
        },
        right: {
          upper: 0.5 + cue * 0.6,
          fore: 1.0,
          twist: cue,
          hand: 'reach',
        },
      }
    case 'fredagain':
      return {
        lean: lean * 0.85,
        stance: 1.05,
        headTilt: headNod + 0.05,
        left: {
          upper: -0.45 - flashLift * 0.4,
          fore: -1.05,
          twist: -0.15,
          hand: 'heart',
        },
        right: {
          upper: 1.0 + cue * 0.12 + pad,
          fore: 0.75,
          twist: cue * 0.35,
          hand: 'reach',
        },
      }
    case 'custom':
    case 'mix':
    default:
      return armsForStyle('house', k)
  }
}

/** Crowd arms — optional overhead wave on beat */
export function armsForCrowd(
  style: DanceStyleId,
  k: DanceKinetics,
  phase: number,
  wave: boolean,
): StyleArms {
  const base = armsForStyle(style, k)
  if (!wave) return base
  const w = Math.sin(phase + k.cue * 3) * 0.5 + 0.5
  const side = phase % (Math.PI * 2) > Math.PI ? 'left' : 'right'
  if (side === 'right') {
    return {
      ...base,
      right: {
        upper: -1.35 + w * 0.45,
        fore: -0.55 + w * 0.25,
        twist: 0.15,
        hand: 'wave',
      },
    }
  }
  return {
    ...base,
    left: {
      upper: 1.35 - w * 0.45,
      fore: 0.55 - w * 0.25,
      twist: -0.15,
      hand: 'wave',
    },
  }
}

/** Crowd slot — stadium tier (feetYFrac = feet anchor 0…1 down the canvas) */
export interface CrowdSlot {
  id: number
  xRatio: number
  /** Feet line as fraction of canvas height */
  feetYFrac: number
  scale: number
  appearance: CharacterAppearance
  phase: number
  row: number
  wave: boolean
}

export const CROWD_ROWS = 10
export const CROWD_FRONT_SPLIT = 5

/** Explicit tier table — wide vertical gaps so rows don't collapse into one band */
const ROW_FEET_Y = [0.24, 0.32, 0.40, 0.48, 0.55, 0.62, 0.70, 0.78, 0.86, 0.94]
const ROW_SCALE = [0.10, 0.15, 0.21, 0.29, 0.38, 0.50, 0.66, 0.86, 1.08, 1.38]
const ROW_ALPHA = [0.28, 0.36, 0.44, 0.54, 0.62, 0.72, 0.82, 0.92, 0.98, 1]
const ROW_ARC = [0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40, 0.44, 0.48]

export function crowdRowLayout(row: number) {
  const r = Math.max(0, Math.min(CROWD_ROWS - 1, row))
  return {
    feetYFrac: ROW_FEET_Y[r],
    scale: ROW_SCALE[r],
    arcHalf: ROW_ARC[r],
    alpha: ROW_ALPHA[r],
  }
}

export function crowdRowAlpha(row: number): number {
  return crowdRowLayout(row).alpha
}

export function crowdRowScale(_row: number): number {
  return 1
}

export function crowdFeetY(slot: CrowdSlot, canvasH: number): number {
  return canvasH * slot.feetYFrac
}

/** Head anchor for speech bubbles */
export function crowdHeadPosition(
  slot: CrowdSlot,
  cx: number,
  canvasH: number,
  w: number,
  sizeScale: number,
): { x: number; y: number } {
  const feetY = crowdFeetY(slot, canvasH)
  const scale = slot.scale * sizeScale
  const charScale = scale < 0.19 ? scale * 2.2 : scale
  const headLift = scale < 0.19 ? 32 * charScale : 98 * scale
  return {
    x: cx + slot.xRatio * w,
    y: feetY - headLift,
  }
}

const SKIN_TONES = [
  '#f0d0b0', '#d4b39a', '#e0bc9a', '#c89b7b', '#b89070', '#a87858', '#9a7058', '#8a6048',
]
const TOP_COLORS = [
  ['#1a2838', '#4488cc'], ['#4a3560', '#9b7ec8'], ['#8b3030', '#ff8866'],
  ['#3d5240', '#88cc88'], ['#524030', '#d4a060'], ['#2a3038', '#c8d0da'],
  ['#404858', '#c0c8d8'], ['#5a2848', '#ff88bb'], ['#283828', '#88ff66'],
  ['#1a1e24', '#8899aa'], ['#3a3848', '#ffaa66'], ['#2d4a5a', '#6ec8e8'],
]
const EXPRESSIONS: CharacterAppearance['expression'][] = [
  'focus', 'smile', 'closed', 'wide', 'cool',
]
const HAIR_STYLES: CharacterAppearance['hairStyle'][] = [
  'short', 'long', 'bun', 'cap', 'curly',
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function appearanceFromSeed(rand: () => number, i: number): CharacterAppearance {
  const skin = SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]
  const [top, accent] = TOP_COLORS[Math.floor(rand() * TOP_COLORS.length)]
  const hairStyle = HAIR_STYLES[Math.floor(rand() * HAIR_STYLES.length)]
  const expression = EXPRESSIONS[Math.floor(rand() * EXPRESSIONS.length)]
  const hairHue = Math.floor(rand() * 40)
  return {
    skin,
    hair: `hsl(${hairHue + 10}, 18%, ${12 + (i % 5) * 4}%)`,
    top,
    topAccent: accent,
    pants: '#0e1218',
    shoeAccent: accent,
    expression,
    hairStyle,
    hasHeadphones: rand() > 0.72,
  }
}

/** Stadium tiers — each row fixed Y band, front rows much larger */
export function generateCrowd(seed = 20260808): CrowdSlot[] {
  const rand = mulberry32(seed)
  const slots: CrowdSlot[] = []
  let id = 0

  for (let row = 0; row < CROWD_ROWS; row++) {
    const layout = crowdRowLayout(row)
    const count = Math.floor(9 + row * 2.4)

    for (let c = 0; c < count; c++) {
      const u = count <= 1 ? 0.5 : c / (count - 1)
      let xRatio = -layout.arcHalf + u * layout.arcHalf * 2
      xRatio += (rand() - 0.5) * 0.01

      if (row < 4 && Math.abs(xRatio) < 0.1) continue

      slots.push({
        id: id++,
        xRatio,
        feetYFrac: layout.feetYFrac,
        scale: layout.scale,
        appearance: appearanceFromSeed(rand, id),
        phase: rand() * Math.PI * 2,
        row,
        wave: row >= CROWD_ROWS - 3 ? rand() > 0.15 : rand() > 0.5,
      })
    }
  }

  return slots.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.xRatio - b.xRatio
  })
}

export const CROWD_LAYOUT: CrowdSlot[] = generateCrowd()

/** DJ look per booth category */
export function djAppearance(style: DanceStyleId): CharacterAppearance {
  const base: Record<DanceStyleId, CharacterAppearance> = {
    house: {
      skin: '#d4b39a',
      hair: '#141820',
      top: '#3a4554',
      topAccent: '#e8a46a',
      pants: '#232b36',
      shoeAccent: '#e8a46a',
      expression: 'focus',
      hairStyle: 'short',
      hasHeadphones: true,
    },
    techno: {
      skin: '#c4a48a',
      hair: '#0a0c10',
      top: '#1a1e24',
      topAccent: '#8899aa',
      pants: '#101418',
      shoeAccent: '#667788',
      expression: 'cool',
      hairStyle: 'short',
      hasHeadphones: true,
    },
    melodic: {
      skin: '#e0bc9a',
      hair: '#2a2018',
      top: '#4a3848',
      topAccent: '#c898b8',
      pants: '#282030',
      shoeAccent: '#d8a8c8',
      expression: 'closed',
      hairStyle: 'long',
      hasHeadphones: true,
    },
    deep: {
      skin: '#b89070',
      hair: '#1a1410',
      top: '#2a3440',
      topAccent: '#6080a0',
      pants: '#181e28',
      shoeAccent: '#5080b0',
      expression: 'smile',
      hairStyle: 'curly',
      hasHeadphones: true,
    },
    trance: {
      skin: '#f0d0b0',
      hair: '#f8f0e0',
      top: '#384858',
      topAccent: '#88ddff',
      pants: '#202830',
      shoeAccent: '#66ccff',
      expression: 'wide',
      hairStyle: 'long',
      hasHeadphones: true,
    },
    dnb: {
      skin: '#a87858',
      hair: '#101010',
      top: '#283828',
      topAccent: '#88ff66',
      pants: '#101810',
      shoeAccent: '#66cc44',
      expression: 'wide',
      hairStyle: 'cap',
      hasHeadphones: true,
    },
    fredagain: {
      skin: '#d4b39a',
      hair: '#1a1e22',
      top: '#2a3038',
      topAccent: '#c8d0da',
      pants: '#1c2028',
      shoeAccent: '#8899aa',
      expression: 'focus',
      hairStyle: 'short',
      hasHeadphones: true,
    },
    mix: {
      skin: '#d4b39a',
      hair: '#141820',
      top: '#3a4554',
      topAccent: '#e8a46a',
      pants: '#232b36',
      shoeAccent: '#e8a46a',
      expression: 'focus',
      hairStyle: 'short',
      hasHeadphones: true,
    },
    custom: {
      skin: '#d4b39a',
      hair: '#141820',
      top: '#454a58',
      topAccent: '#ff8866',
      pants: '#232b36',
      shoeAccent: '#ff8866',
      expression: 'smile',
      hairStyle: 'curly',
      hasHeadphones: true,
    },
  }
  return base[style] ?? base.house
}

export function roundRect(
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

export function drawClubCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  k: DanceKinetics,
  arms: StyleArms,
  look: CharacterAppearance,
  opts?: { upperOnly?: boolean },
) {
  if (scale < 0.19) {
    drawCrowdSilhouette(ctx, cx, baseY, scale, k, look)
    return
  }

  if (opts?.upperOnly) {
    drawUpperBody(ctx, cx, baseY, scale, k, arms, look)
    return
  }

  ctx.save()
  ctx.translate(cx + k.hipX * 0.35, baseY - k.bounce - k.breathY)
  ctx.scale(scale, scale)
  ctx.rotate(k.hipX * 0.012 * arms.stance)

  ctx.fillStyle = 'rgba(0,0,0,0.32)'
  ctx.beginPath()
  ctx.ellipse(0, 10, 48 + Math.abs(k.step) * 4, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  const kneeBend = k.kneeBend * arms.stance
  drawLeg(ctx, look, -18 * arms.stance, -6, -0.22 - k.leftWeight * 0.08, kneeBend + k.leftWeight * 0.12, k.step > 0)
  drawLeg(ctx, look, 18 * arms.stance, -6, 0.22 + k.rightWeight * 0.08, kneeBend + k.rightWeight * 0.12, k.step < 0)

  ctx.save()
  ctx.translate(0, -28)
  ctx.rotate(arms.lean * 0.35)
  ctx.fillStyle = look.pants
  roundRect(ctx, -22, -8, 44, 24, 10)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(0, -36)
  ctx.rotate(arms.lean)

  const bodyGrad = ctx.createLinearGradient(0, -70, 0, 20)
  bodyGrad.addColorStop(0, look.top)
  bodyGrad.addColorStop(1, '#151b24')
  ctx.fillStyle = bodyGrad
  roundRect(ctx, -26, -72, 52, 78, 16)
  ctx.fill()

  ctx.fillStyle = look.topAccent
  roundRect(ctx, -26, -50, 5, 40, 2)
  ctx.fill()

  ctx.fillStyle = look.top
  ctx.beginPath()
  ctx.ellipse(-24, -62, 12, 9, -0.25, 0, Math.PI * 2)
  ctx.ellipse(24, -62, 12, 9, 0.25, 0, Math.PI * 2)
  ctx.fill()

  drawArm(ctx, look, 22, -58, arms.right)
  drawArm(ctx, look, -22, -58, arms.left)

  ctx.fillStyle = look.skin
  roundRect(ctx, -6, -88, 12, 14, 4)
  ctx.fill()

  ctx.save()
  ctx.translate(0, -98)
  ctx.rotate(arms.headTilt)

  if (look.hasHeadphones) {
    ctx.strokeStyle = '#c8d0da'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, -2, 22, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
  }

  drawHair(ctx, look)
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2)
  ctx.fill()

  if (look.hasHeadphones) {
    ctx.fillStyle = '#252b34'
    ctx.beginPath()
    ctx.ellipse(-22, 0, 7, 10, 0.15, 0, Math.PI * 2)
    ctx.ellipse(22, 0, 7, 10, -0.2, 0, Math.PI * 2)
    ctx.fill()
  }

  drawFace(ctx, look.expression)

  ctx.restore()
  ctx.restore()
  ctx.restore()
}

/** DJ behind decks — torso, arms, head only */
function drawUpperBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  k: DanceKinetics,
  arms: StyleArms,
  look: CharacterAppearance,
) {
  ctx.save()
  ctx.translate(cx + k.hipX * 0.2, baseY - k.bounce * 0.6 - k.breathY)
  ctx.scale(scale, scale)
  ctx.rotate(k.hipX * 0.008 * arms.stance)

  ctx.save()
  ctx.translate(0, -36)
  ctx.rotate(arms.lean)

  const bodyGrad = ctx.createLinearGradient(0, -70, 0, 20)
  bodyGrad.addColorStop(0, look.top)
  bodyGrad.addColorStop(1, '#151b24')
  ctx.fillStyle = bodyGrad
  roundRect(ctx, -26, -72, 52, 78, 16)
  ctx.fill()

  ctx.fillStyle = look.topAccent
  roundRect(ctx, -26, -50, 5, 40, 2)
  ctx.fill()

  ctx.fillStyle = look.top
  ctx.beginPath()
  ctx.ellipse(-24, -62, 12, 9, -0.25, 0, Math.PI * 2)
  ctx.ellipse(24, -62, 12, 9, 0.25, 0, Math.PI * 2)
  ctx.fill()

  drawArm(ctx, look, 22, -58, arms.right)
  drawArm(ctx, look, -22, -58, arms.left)

  ctx.fillStyle = look.skin
  roundRect(ctx, -6, -88, 12, 14, 4)
  ctx.fill()

  ctx.save()
  ctx.translate(0, -98)
  ctx.rotate(arms.headTilt)

  if (look.hasHeadphones) {
    ctx.strokeStyle = '#c8d0da'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, -2, 22, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
  }

  drawHair(ctx, look)
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2)
  ctx.fill()

  if (look.hasHeadphones) {
    ctx.fillStyle = '#252b34'
    ctx.beginPath()
    ctx.ellipse(-22, 0, 7, 10, 0.15, 0, Math.PI * 2)
    ctx.ellipse(22, 0, 7, 10, -0.2, 0, Math.PI * 2)
    ctx.fill()
  }

  drawFace(ctx, look.expression)
  ctx.restore()
  ctx.restore()
  ctx.restore()
}

/** Lightweight back-row raver — still bounces with beat */
function drawCrowdSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  k: DanceKinetics,
  look: CharacterAppearance,
) {
  const bounce = k.bounce * scale * 0.8
  const sway = k.hipX * 0.02
  ctx.save()
  ctx.translate(cx + sway, baseY - bounce)
  ctx.scale(scale * 2.2, scale * 2.2)
  ctx.fillStyle = look.top
  ctx.beginPath()
  ctx.ellipse(0, -18, 10, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.arc(0, -32, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.hair
  ctx.beginPath()
  ctx.arc(0, -36, 7, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawHair(ctx: CanvasRenderingContext2D, look: CharacterAppearance) {
  ctx.fillStyle = look.hair
  switch (look.hairStyle) {
    case 'long':
      ctx.beginPath()
      ctx.ellipse(0, -8, 20, 14, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-16, 4, 8, 14, -0.3, 0, Math.PI * 2)
      ctx.ellipse(16, 4, 8, 14, 0.3, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'bun':
      ctx.beginPath()
      ctx.arc(0, -14, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(0, -8, 18, 10, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      break
    case 'cap':
      ctx.beginPath()
      ctx.ellipse(0, -12, 20, 8, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = look.topAccent
      roundRect(ctx, -18, -14, 36, 6, 2)
      ctx.fill()
      break
    case 'curly':
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.arc(i * 7, -10, 7, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    default:
      ctx.beginPath()
      ctx.ellipse(0, -10, 19, 12, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-14, -2, 7, 11, -0.5, 0, Math.PI * 2)
      ctx.ellipse(14, -2, 7, 11, 0.5, 0, Math.PI * 2)
      ctx.fill()
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  expression: CharacterAppearance['expression'],
) {
  ctx.strokeStyle = 'rgba(40,30,28,0.85)'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  switch (expression) {
    case 'smile':
      ctx.beginPath()
      ctx.arc(-5, 1, 3, 0.2, Math.PI - 0.2)
      ctx.arc(5, 1, 3, 0.2, Math.PI - 0.2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-4, 10)
      ctx.quadraticCurveTo(0, 14, 4, 10)
      ctx.stroke()
      break
    case 'closed':
      ctx.beginPath()
      ctx.moveTo(-9, 2)
      ctx.quadraticCurveTo(-5, 4, -1, 2)
      ctx.moveTo(1, 2)
      ctx.quadraticCurveTo(5, 4, 9, 2)
      ctx.stroke()
      break
    case 'wide':
      ctx.fillStyle = 'rgba(30,20,18,0.7)'
      ctx.beginPath()
      ctx.ellipse(-5, 2, 3, 4, 0, 0, Math.PI * 2)
      ctx.ellipse(5, 2, 3, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 12, 4, 0, Math.PI)
      ctx.stroke()
      break
    case 'cool':
      ctx.strokeStyle = 'rgba(40,30,28,0.6)'
      ctx.beginPath()
      ctx.moveTo(-9, 0)
      ctx.lineTo(-2, 1)
      ctx.moveTo(2, 1)
      ctx.lineTo(9, 0)
      ctx.stroke()
      break
    default:
      ctx.beginPath()
      ctx.moveTo(-8, 2)
      ctx.lineTo(-3, 3)
      ctx.moveTo(3, 3)
      ctx.lineTo(8, 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-3, 10)
      ctx.quadraticCurveTo(0, 12, 3, 10)
      ctx.stroke()
  }
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  look: CharacterAppearance,
  x: number,
  y: number,
  hipAngle: number,
  kneeBend: number,
  lifted: boolean,
) {
  const lift = lifted ? -4 : 0
  ctx.save()
  ctx.translate(x, y + lift)
  ctx.rotate(hipAngle)
  ctx.fillStyle = look.pants
  roundRect(ctx, -8, 0, 16, 28, 8)
  ctx.fill()
  ctx.translate(0, 26)
  ctx.rotate(kneeBend)
  ctx.fillStyle = '#1c232d'
  roundRect(ctx, -7, 0, 14, 26, 7)
  ctx.fill()
  ctx.translate(0, 24)
  ctx.fillStyle = '#0e1218'
  roundRect(ctx, -9, 0, 20, 8, 3)
  ctx.fill()
  ctx.fillStyle = look.shoeAccent
  roundRect(ctx, -9, 5, 20, 3, 1)
  ctx.fill()
  ctx.restore()
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  look: CharacterAppearance,
  x: number,
  y: number,
  pose: ArmPose,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(pose.upper)
  ctx.strokeStyle = look.top
  ctx.lineWidth = 11
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 30)
  ctx.stroke()
  ctx.translate(0, 30)
  ctx.rotate(pose.fore + pose.twist * 0.3)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 28)
  ctx.stroke()
  ctx.translate(0, 30)
  ctx.rotate(pose.twist)
  ctx.fillStyle = look.skin
  if (pose.hand === 'reach') {
    ctx.beginPath()
    ctx.ellipse(0, 2, 8, 5, 0.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (pose.hand === 'up') {
    ctx.beginPath()
    ctx.arc(0, -2, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (pose.hand === 'heart') {
    ctx.beginPath()
    ctx.arc(-3, 0, 5, 0, Math.PI * 2)
    ctx.arc(3, 0, 5, 0, Math.PI * 2)
    ctx.fill()
  } else if (pose.hand === 'wave') {
    ctx.strokeStyle = look.skin
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath()
      ctx.moveTo(f * 3, -4)
      ctx.quadraticCurveTo(f * 6, -10, f * 4, -14)
      ctx.stroke()
    }
    ctx.fillStyle = look.skin
    ctx.beginPath()
    ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, 2, 6.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

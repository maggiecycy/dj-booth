import type { CrowdSlot } from './characters'
import { crowdHeadPosition } from './characters'

export interface CrowdBubble {
  x: number
  y: number
  text: string
  life: number
  maxLife: number
  scale: number
}

const MOOD_PHRASES = [
  '🔥🔥🔥',
  'LFG!!!',
  'this drop!!',
  'crying rn',
  'best set ever',
  'vibes only',
  'no cap',
  'slay',
  'immaculate',
  'main character',
  'I needed this',
  'turn it UP',
  'unhinged',
  'chef kiss',
  'living for this',
  'peak',
  'insane',
  'go off',
  'YES!!!',
  '🙌🙌',
  'W set',
  'im dead 💀',
  'core memory',
  'understood the assignment',
  'rent free',
  'absolutely sent',
  'touch the sky',
  'never leaving',
  '★ ★ ★',
  '!!!',
]

export class CrowdBubbleSystem {
  private items: CrowdBubble[] = []
  private spawnTimer = 1.5

  update(
    dt: number,
    playing: boolean,
    slots: CrowdSlot[],
    cx: number,
    canvasH: number,
    w: number,
    sizeScale: number,
  ) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i]
      b.life -= dt / b.maxLife
      b.y -= 22 * dt
      if (b.life <= 0) this.items.splice(i, 1)
    }

    if (!playing || slots.length === 0) return

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      const front = slots.filter((s) => s.row >= 5)
      const pool = front.length > 0 ? front : slots
      const slot = pool[Math.floor(Math.random() * pool.length)]
      const phrase = MOOD_PHRASES[Math.floor(Math.random() * MOOD_PHRASES.length)]
      this.spawnAtSlot(slot, phrase, cx, canvasH, w, sizeScale)
      this.spawnTimer = 1.4 + Math.random() * 3.4
    }
  }

  /** User-sent vibe from a random crowd head */
  spawnUser(
    text: string,
    slots: CrowdSlot[],
    cx: number,
    canvasH: number,
    w: number,
    sizeScale: number,
  ) {
    const trimmed = text.trim().slice(0, 48)
    if (!trimmed || slots.length === 0) return
    const front = slots.filter((s) => s.row >= 5)
    const slot = front[Math.floor(Math.random() * front.length)] ?? slots[0]
    this.spawnAtSlot(slot, trimmed, cx, canvasH, w, sizeScale, 3.2)
  }

  private spawnAtSlot(
    slot: CrowdSlot,
    text: string,
    cx: number,
    canvasH: number,
    w: number,
    sizeScale: number,
    life = 2.4,
  ) {
    if (this.items.length > 24) this.items.shift()
    const head = crowdHeadPosition(slot, cx, canvasH, w, sizeScale)
    this.items.push({
      x: head.x,
      y: head.y - 8,
      text,
      life: 1,
      maxLife: life,
      scale: 0.85 + slot.row * 0.04,
    })
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 13px "DM Sans", system-ui, sans-serif'

    for (const b of this.items) {
      const a = Math.max(0, b.life)
      const padX = 10
      const metrics = ctx.measureText(b.text)
      const bw = metrics.width + padX * 2
      const bh = 22
      const bx = b.x - bw / 2
      const by = b.y - bh - 4

      ctx.save()
      ctx.globalAlpha = a
      ctx.translate(b.x, b.y)
      ctx.scale(b.scale, b.scale)
      ctx.translate(-b.x, -b.y)

      ctx.fillStyle = 'rgba(18, 24, 32, 0.92)'
      ctx.beginPath()
      ctx.moveTo(b.x - 5, by + bh)
      ctx.lineTo(b.x, by + bh + 8)
      ctx.lineTo(b.x + 5, by + bh)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = 'rgba(18, 24, 32, 0.92)'
      ctx.strokeStyle = 'rgba(232, 164, 106, 0.55)'
      ctx.lineWidth = 1.2
      roundRect(ctx, bx, by, bw, bh, 10)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = 'rgba(243, 235, 226, 0.95)'
      ctx.fillText(b.text, b.x, by + bh / 2 + 1)
      ctx.restore()
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
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

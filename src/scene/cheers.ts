/** Floating call-outs on tap — hype the DJ */

export interface CheerParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  text: string
  size: number
  rot: number
}

const CALLS = ['🔥', 'YES!', 'WOW', '▲▲', '❤️', 'GO!', '✨', 'LFG', '!!!', '🙌']

export class CheerSystem {
  private items: CheerParticle[] = []

  spawn(x: number, y: number, intensity = 1) {
    const n = Math.floor(3 + intensity * 5)
    for (let i = 0; i < n; i++) {
      if (this.items.length > 48) this.items.shift()
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
      const speed = 60 + Math.random() * 120
      this.items.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 1,
        maxLife: 0.9 + Math.random() * 0.6,
        text: CALLS[Math.floor(Math.random() * CALLS.length)],
        size: 14 + Math.random() * 10,
        rot: (Math.random() - 0.5) * 0.5,
      })
    }
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]
      p.life -= dt / p.maxLife
      p.vy += 40 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 0.5
      if (p.life <= 0) this.items.splice(i, 1)
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of this.items) {
      const a = Math.max(0, p.life)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = a
      ctx.font = `700 ${p.size}px Syne, system-ui, sans-serif`
      ctx.fillStyle = `rgba(255, 220, 180, ${0.85 * a})`
      ctx.fillText(p.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }
}

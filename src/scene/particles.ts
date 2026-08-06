/** Beat-synced full-screen particles — confetti / streaks / orbs */

export type ParticleKind = 'confetti' | 'streak' | 'orb' | 'ring'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rot: number
  rotSpeed: number
  kind: ParticleKind
  color: string
}

const COLORS = [
  '#e8a46a', '#ff8866', '#88ccff', '#ff66aa', '#88ff66', '#ffffff', '#c8d0da',
]

export class ParticleSystem {
  private pool: Particle[] = []
  private w = 1
  private h = 1

  resize(w: number, h: number) {
    this.w = w
    this.h = h
  }

  /** Burst on beat / energy spike */
  burst(intensity: number, cx: number, cy: number, amount = 1) {
    const amt = Math.max(0.2, amount)
    const count = Math.floor((28 + intensity * 95) * amt)
    for (let i = 0; i < count; i++) {
      this.spawn(cx, cy, intensity * amt)
    }
    if (intensity * amt > 0.25) {
      const sideN = Math.floor(8 + amt * 18)
      for (let i = 0; i < sideN; i++) {
        this.spawn(
          Math.random() < 0.5 ? 0 : this.w,
          this.h * (0.12 + Math.random() * 0.55),
          intensity * amt,
        )
      }
    }
  }

  /** Drag trail — lighter continuous sprinkle */
  trail(x: number, y: number, power = 0.55) {
    this.spawn(x, y, power)
    if (Math.random() < 0.65) {
      this.spawn(x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 20, power * 0.75)
    }
    if (Math.random() < 0.35) {
      this.spawn(x, y, power * 0.5)
    }
  }

  /** Full-stage overload burst */
  screenFill(intensity: number, amount = 1) {
    const amt = Math.max(0.5, amount)
    const n = Math.floor(14 + intensity * 24)
    for (let i = 0; i < n; i++) {
      this.spawn(
        Math.random() * this.w,
        Math.random() * this.h * 0.82,
        intensity * amt,
      )
    }
  }

  sprinkle(energy: number, amount = 1) {
    const amt = Math.max(0.15, amount)
    if (energy < 0.15 || Math.random() > energy * 0.22 * amt) return
    this.spawn(Math.random() * this.w, -10, energy * 0.7 * amt)
    if (energy > 0.35 && Math.random() < 0.55 * amt) {
      this.spawn(Math.random() * this.w, this.h + 8, energy * 0.55 * amt)
    }
    if (energy > 0.5 && Math.random() < 0.25 * amt) {
      this.spawn(Math.random() * this.w, this.h * 0.35, energy * 0.45 * amt)
    }
  }

  private spawn(x: number, y: number, power: number) {
    if (this.pool.length > 480) this.pool.shift()
    const angle = Math.random() * Math.PI * 2
    const speed = (100 + Math.random() * 280) * (0.45 + power)
    const kinds: ParticleKind[] = ['confetti', 'confetti', 'streak', 'orb', 'ring']
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    this.pool.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 1,
      maxLife: 0.6 + Math.random() * 0.9,
      size: kind === 'orb' ? 8 + Math.random() * 14 : 4 + Math.random() * 9,
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 8,
      kind,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
  }

  update(dt: number) {
    const g = 120
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i]
      p.life -= dt / p.maxLife
      p.vy += g * dt * 0.35
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.rotSpeed * dt
      p.vx *= 1 - dt * 0.4
      if (p.life <= 0 || p.y > this.h + 40 || p.x < -40 || p.x > this.w + 40) {
        this.pool.splice(i, 1)
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.pool) {
      const a = Math.max(0, p.life) * 0.85
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = a

      switch (p.kind) {
        case 'streak':
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(-p.size * 2, 0)
          ctx.lineTo(p.size * 2, 0)
          ctx.stroke()
          break
        case 'orb':
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'ring':
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.stroke()
          break
        default:
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      ctx.restore()
    }
    ctx.restore()
  }
}

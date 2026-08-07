/** Flying club props launched from side rails → across the stage */

export type PropKind =
  | 'champagne'
  | 'vinyl'
  | 'cocktail'
  | 'glowstick'
  | 'disco'
  | 'bass'
  | 'lighter'
  | 'confetti'
  | 'can'
  | 'mic'
  | 'phone'
  | 'cash'
  | 'shades'
  | 'hat'
  | 'ball'
  | 'horn'

export interface PropDef {
  id: PropKind
  label: string
  hint: string
}

export const PROP_DEFS: PropDef[] = [
  { id: 'champagne', label: 'Bottle', hint: 'Champagne pop' },
  { id: 'vinyl', label: 'Vinyl', hint: 'Spinning disc' },
  { id: 'cocktail', label: 'Drink', hint: 'Glass splash' },
  { id: 'can', label: 'Can', hint: 'Beer can toss' },
  { id: 'mic', label: 'Mic', hint: 'Drop the mic' },
  { id: 'phone', label: 'Phone', hint: 'Phone in the air' },
  { id: 'cash', label: 'Cash', hint: 'Make it rain' },
  { id: 'shades', label: 'Shades', hint: 'Sunglasses fly' },
  { id: 'hat', label: 'Hat', hint: 'Cap in the air' },
  { id: 'ball', label: 'Ball', hint: 'Beach ball bounce' },
  { id: 'horn', label: 'Horn', hint: 'Party horn blast' },
  { id: 'glowstick', label: 'Glow', hint: 'Neon trails' },
  { id: 'disco', label: 'Disco', hint: 'Mirror ball hits' },
  { id: 'bass', label: 'Bass', hint: 'Bass rings anywhere' },
  { id: 'lighter', label: 'Lights', hint: 'Phone / lighter wave' },
  { id: 'confetti', label: 'Toss', hint: 'Confetti from many spots' },
]

interface PropSprite {
  kind: PropKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotV: number
  life: number
  maxLife: number
  scale: number
  side: -1 | 1
  color?: string
}

export class PropFxSystem {
  private items: PropSprite[] = []

  spawn(kind: PropKind, side: 'left' | 'right', w: number, h: number): void {
    const dir: -1 | 1 = side === 'left' ? 1 : -1
    const x0 = side === 'left' ? w * 0.08 : w * 0.92
    const y0 = h * (0.28 + Math.random() * 0.35)

    if (kind === 'bass') {
      // Several ring packs at random stage spots (not a fixed speaker corner)
      const packs = 3 + Math.floor(Math.random() * 2)
      for (let p = 0; p < packs; p++) {
        const cx = w * (0.12 + Math.random() * 0.76)
        const cy = h * (0.28 + Math.random() * 0.42)
        const rings = 2 + Math.floor(Math.random() * 2)
        for (let i = 0; i < rings; i++) {
          this.items.push({
            kind,
            x: cx + (Math.random() - 0.5) * 18,
            y: cy + (Math.random() - 0.5) * 14,
            vx: 0,
            vy: 0,
            rot: i * 0.35,
            rotV: 0,
            life: 0.85 + i * 0.14 + Math.random() * 0.15,
            maxLife: 1.1,
            scale: 0.15 + Math.random() * 0.12,
            side: dir,
          })
        }
      }
      return
    }

    if (kind === 'lighter') {
      for (let i = 0; i < 14; i++) {
        this.items.push({
          kind,
          x: w * (0.12 + Math.random() * 0.76),
          y: h * (0.55 + Math.random() * 0.28),
          vx: (Math.random() - 0.5) * 20,
          vy: -20 - Math.random() * 40,
          rot: 0,
          rotV: 0,
          life: 1.1 + Math.random() * 0.5,
          maxLife: 1.4,
          scale: 0.6 + Math.random() * 0.5,
          side: dir,
        })
      }
      return
    }

    if (kind === 'confetti') {
      // Burst from several random origins across the stage
      const origins = 4 + Math.floor(Math.random() * 3)
      const colors = ['#e8a46a', '#ff8866', '#88ccff', '#ff66aa', '#88ff66', '#ffffff']
      for (let o = 0; o < origins; o++) {
        const ox = w * (0.1 + Math.random() * 0.8)
        const oy = h * (0.18 + Math.random() * 0.5)
        const count = 8 + Math.floor(Math.random() * 8)
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2
          const spd = 80 + Math.random() * 200
          this.items.push({
            kind,
            x: ox + (Math.random() - 0.5) * 24,
            y: oy + (Math.random() - 0.5) * 20,
            vx: Math.cos(ang) * spd + dir * 40,
            vy: Math.sin(ang) * spd * 0.7 - 60 - Math.random() * 100,
            rot: Math.random() * Math.PI,
            rotV: (Math.random() - 0.5) * 12,
            life: 1.3 + Math.random() * 0.7,
            maxLife: 2,
            scale: 0.5 + Math.random() * 0.8,
            side: dir,
            color: colors[Math.floor(Math.random() * colors.length)],
          })
        }
      }
      return
    }

    if (kind === 'cash') {
      // Bills flutter from several spots
      const origins = 3 + Math.floor(Math.random() * 2)
      for (let o = 0; o < origins; o++) {
        const ox = w * (0.15 + Math.random() * 0.7)
        const oy = h * (0.2 + Math.random() * 0.35)
        for (let i = 0; i < 7; i++) {
          this.items.push({
            kind,
            x: ox + (Math.random() - 0.5) * 30,
            y: oy + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 160 + dir * 50,
            vy: -40 - Math.random() * 120,
            rot: Math.random() * Math.PI,
            rotV: (Math.random() - 0.5) * 8,
            life: 1.6 + Math.random() * 0.6,
            maxLife: 2.2,
            scale: 0.85 + Math.random() * 0.5,
            side: dir,
          })
        }
      }
      return
    }

    if (kind === 'glowstick') {
      for (let i = 0; i < 5; i++) {
        this.items.push({
          kind,
          x: x0 + (Math.random() - 0.5) * 20,
          y: y0 + (i - 2) * 18 + (Math.random() - 0.5) * 10,
          vx: dir * (200 + Math.random() * 120),
          vy: -40 + (Math.random() - 0.5) * 100,
          rot: Math.random() * Math.PI,
          rotV: dir * (4 + Math.random() * 4),
          life: 1.5,
          maxLife: 1.5,
          scale: 1,
          side: dir,
        })
      }
      return
    }

    if (kind === 'disco') {
      // Sparks from a few random ball hits, not always dead center
      const hits = 2 + Math.floor(Math.random() * 2)
      for (let hIdx = 0; hIdx < hits; hIdx++) {
        const cx = w * (0.25 + Math.random() * 0.5)
        const cy = h * (0.14 + Math.random() * 0.22)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4
          this.items.push({
            kind,
            x: cx,
            y: cy,
            vx: Math.cos(a) * (80 + Math.random() * 140),
            vy: Math.sin(a) * (60 + Math.random() * 100),
            rot: a,
            rotV: 3,
            life: 1.2,
            maxLife: 1.2,
            scale: 0.7,
            side: dir,
          })
        }
      }
      return
    }

    // Physical throwables — bottle / vinyl / drink / can / mic / phone / shades / hat / ball / horn
    const count =
      kind === 'can' || kind === 'phone' || kind === 'shades' || kind === 'hat'
        ? 2 + Math.floor(Math.random() * 2)
        : kind === 'ball'
          ? 1 + Math.floor(Math.random() * 2)
          : 1

    for (let i = 0; i < count; i++) {
      const spread = i === 0 ? 0 : (Math.random() - 0.5) * 40
      const isBall = kind === 'ball'
      this.items.push({
        kind,
        x: x0 + spread,
        y: y0 + (Math.random() - 0.5) * 50,
        vx: dir * (180 + Math.random() * 120) + (Math.random() - 0.5) * 60,
        vy: -100 - Math.random() * (isBall ? 140 : 100),
        rot: (Math.random() - 0.5) * 0.8,
        rotV: dir * (isBall ? 5 + Math.random() * 5 : 2.5 + Math.random() * 4),
        life: 1.7 + Math.random() * 0.4,
        maxLife: 2.1,
        scale:
          kind === 'vinyl'
            ? 1.15
            : kind === 'mic' || kind === 'horn'
              ? 1.1
              : kind === 'ball'
                ? 1.25
                : 1,
        side: dir,
        color: isBall
          ? ['#ff8866', '#88ccff', '#ff66aa', '#88ff66', '#e8a46a'][
              Math.floor(Math.random() * 5)
            ]
          : undefined,
      })
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt
      if (p.kind === 'bass') {
        p.scale += dt * 1.8
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      // Cash flutters lighter; phones/cans tumble heavier
      const g =
        p.kind === 'cash' || p.kind === 'confetti' || p.kind === 'hat'
          ? 180
          : p.kind === 'ball'
            ? 220
            : p.kind === 'phone' || p.kind === 'can' || p.kind === 'horn'
              ? 320
              : 280
      p.vy += g * dt
      // Soft bounce for beach balls near mid-air floor
      if (p.kind === 'ball' && p.vy > 0 && p.life < p.maxLife * 0.55 && p.vy > 80) {
        p.vy *= -0.55
        p.vx *= 0.9
      }
      p.rot += p.rotV * dt
    }
    this.items = this.items.filter((p) => p.life > 0)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = a
      ctx.scale(p.scale, p.scale)

      switch (p.kind) {
        case 'champagne':
          drawChampagne(ctx)
          break
        case 'vinyl':
          drawVinyl(ctx)
          break
        case 'cocktail':
          drawCocktail(ctx)
          break
        case 'glowstick':
          drawGlowstick(ctx)
          break
        case 'disco':
          drawDiscoSpark(ctx)
          break
        case 'bass':
          drawBassRing(ctx, p.scale, a)
          break
        case 'lighter':
          drawLighter(ctx)
          break
        case 'confetti':
          drawConfettiBit(ctx, p.color)
          break
        case 'can':
          drawCan(ctx)
          break
        case 'mic':
          drawMic(ctx)
          break
        case 'phone':
          drawPhone(ctx)
          break
        case 'cash':
          drawCash(ctx)
          break
        case 'shades':
          drawShades(ctx)
          break
        case 'hat':
          drawHat(ctx)
          break
        case 'ball':
          drawBall(ctx, p.color ?? '#ff8866')
          break
        case 'horn':
          drawHorn(ctx)
          break
      }
      ctx.restore()
    }
  }
}

function drawChampagne(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#d4af37'
  ctx.beginPath()
  ctx.moveTo(-6, -28)
  ctx.lineTo(6, -28)
  ctx.lineTo(8, 18)
  ctx.lineTo(-8, 18)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1a222c'
  ctx.fillRect(-5, -36, 10, 10)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(-3, -20, 2.5, 22)
  ctx.fillStyle = 'rgba(255,230,180,0.9)'
  ctx.beginPath()
  ctx.arc(0, -42, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawVinyl(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0a0d12'
  ctx.beginPath()
  ctx.arc(0, 0, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  for (const r of [8, 12, 16, 20]) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#e8a46a'
  ctx.beginPath()
  ctx.arc(0, 0, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a0d12'
  ctx.beginPath()
  ctx.arc(0, 0, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawCocktail(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(240,240,255,0.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-12, -10)
  ctx.lineTo(12, -10)
  ctx.lineTo(0, 12)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,100,140,0.55)'
  ctx.beginPath()
  ctx.moveTo(-9, -8)
  ctx.lineTo(9, -8)
  ctx.lineTo(0, 8)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(240,240,255,0.7)'
  ctx.beginPath()
  ctx.moveTo(0, 12)
  ctx.lineTo(0, 22)
  ctx.moveTo(-8, 22)
  ctx.lineTo(8, 22)
  ctx.stroke()
}

function drawCan(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#c45c26'
  roundish(ctx, -9, -16, 18, 32, 4)
  ctx.fill()
  ctx.fillStyle = '#e8a46a'
  ctx.fillRect(-9, -4, 18, 10)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(-6, -12, 3, 20)
  ctx.fillStyle = '#2a3038'
  ctx.fillRect(-7, -18, 14, 3)
}

function drawMic(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#c8d0d8'
  ctx.beginPath()
  ctx.ellipse(0, -14, 9, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,48,56,0.55)'
  ctx.lineWidth = 1.2
  for (const y of [-18, -14, -10]) {
    ctx.beginPath()
    ctx.moveTo(-7, y)
    ctx.lineTo(7, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#1a222c'
  ctx.fillRect(-3, -2, 6, 22)
  ctx.fillStyle = '#e8a46a'
  ctx.fillRect(-4, 18, 8, 4)
}

function drawPhone(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#151a22'
  roundish(ctx, -8, -16, 16, 32, 3)
  ctx.fill()
  ctx.fillStyle = '#3a6ea5'
  roundish(ctx, -6, -12, 12, 22, 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(-3, 12, 6, 2)
}

function drawCash(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#4a9a5a'
  ctx.fillRect(-14, -8, 28, 16)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(-14, -8, 28, 16)
  ctx.fillStyle = 'rgba(255,255,220,0.85)'
  ctx.beginPath()
  ctx.arc(0, 0, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(20,40,20,0.45)'
  ctx.fillRect(-11, -5, 6, 10)
  ctx.fillRect(5, -5, 6, 10)
}

function drawShades(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#1a222c'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-16, -2)
  ctx.lineTo(16, -2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(20,40,60,0.85)'
  ctx.beginPath()
  ctx.ellipse(-9, 2, 7, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(9, 2, 7, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232,164,106,0.5)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(-9, 2, 7, 5, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(9, 2, 7, 5, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawHat(ctx: CanvasRenderingContext2D) {
  // Baseball cap
  ctx.fillStyle = '#2a6a9a'
  ctx.beginPath()
  ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, -2, 12, 10, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1e4a6e'
  ctx.beginPath()
  ctx.ellipse(10, 4, 12, 3.5, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e8a46a'
  ctx.beginPath()
  ctx.arc(0, -6, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawBall(ctx: CanvasRenderingContext2D, color: string) {
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 18)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.35, color)
  g.addColorStop(1, '#1a222c')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.quadraticCurveTo(0, -8, 14, 0)
  ctx.moveTo(0, -14)
  ctx.quadraticCurveTo(6, 0, 0, 14)
  ctx.stroke()
}

function drawHorn(ctx: CanvasRenderingContext2D) {
  // Megaphone / party horn cone
  ctx.fillStyle = '#e8a46a'
  ctx.beginPath()
  ctx.moveTo(-4, -8)
  ctx.lineTo(22, -16)
  ctx.lineTo(22, 16)
  ctx.lineTo(-4, 8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1a222c'
  roundish(ctx, -14, -10, 12, 20, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(8, -10)
  ctx.lineTo(8, 10)
  ctx.moveTo(15, -13)
  ctx.lineTo(15, 13)
  ctx.stroke()
  // Sound puffs
  ctx.strokeStyle = 'rgba(232,164,106,0.7)'
  ctx.lineWidth = 1.5
  for (const r of [6, 11]) {
    ctx.beginPath()
    ctx.arc(26, 0, r, -0.7, 0.7)
    ctx.stroke()
  }
}

function drawGlowstick(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(-3, -20, 3, 20)
  g.addColorStop(0, '#66ffcc')
  g.addColorStop(1, '#44aaff')
  ctx.fillStyle = g
  ctx.shadowColor = '#66ffcc'
  ctx.shadowBlur = 12
  roundish(ctx, -3, -22, 6, 44, 3)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawDiscoSpark(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(200,240,255,0.95)'
  ctx.shadowColor = '#aaf0ff'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(2, -2)
  ctx.lineTo(7, 0)
  ctx.lineTo(2, 2)
  ctx.lineTo(0, 7)
  ctx.lineTo(-2, 2)
  ctx.lineTo(-7, 0)
  ctx.lineTo(-2, -2)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawBassRing(ctx: CanvasRenderingContext2D, scale: number, a: number) {
  ctx.strokeStyle = `rgba(232,164,106,${0.55 * a})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, 28 * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(255,255,255,${0.25 * a})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, 18 * scale, 0, Math.PI * 2)
  ctx.stroke()
}

function drawLighter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255,220,140,0.95)'
  ctx.shadowColor = '#ffcc66'
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawConfettiBit(ctx: CanvasRenderingContext2D, color?: string) {
  const colors = ['#e8a46a', '#ff8866', '#88ccff', '#ff66aa', '#88ff66']
  ctx.fillStyle =
    color ?? colors[Math.floor(Math.abs(ctx.getTransform().a * 10)) % colors.length]!
  ctx.fillRect(-4, -2.5, 8, 5)
}

function roundish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

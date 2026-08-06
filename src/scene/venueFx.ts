/** Maps UI slider 0–1 to strong on-stage multipliers (≈0 at min, up to ~4× at max). */
export function fxCurve(v: number): number {
  const t = Math.max(0, Math.min(1, v))
  return t * t * 4
}

export function fxMix(base: number, slider: number, flash = 0): number {
  const t = Math.max(0, Math.min(1, slider))
  if (t < 0.03) return base * 0.06
  return base * (0.1 + fxCurve(t)) * (1 + flash * 0.55)
}

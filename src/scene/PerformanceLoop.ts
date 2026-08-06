/**
 * PerformanceLoop — rAF main loop for the show.
 * Separates timing from React so React only handles UI chrome.
 */

export type FrameCallback = (dt: number, elapsed: number) => void

export class PerformanceLoop {
  private raf = 0
  private last = 0
  private elapsed = 0
  private running = false
  private cb: FrameCallback

  constructor(cb: FrameCallback) {
    this.cb = cb
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const tick = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.elapsed += dt
      this.cb(dt, this.elapsed)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }
}

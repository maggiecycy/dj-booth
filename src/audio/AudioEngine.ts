import { AUDIO } from '../config'
import { averageRange, type BandEnergy } from './analysis'
import type { Track } from './playlist'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'playing' | 'paused'

export interface EngineSnapshot {
  loadState: LoadState
  trackIndex: number
  currentTime: number
  duration: number
  error: string | null
  unlocked: boolean
}

type Listener = (snap: EngineSnapshot) => void

/**
 * AudioEngine — owns AudioContext, decoding, playback, and AnalyserNode.
 *
 * Architecture:
 *   decodeAudioData → AudioBufferSourceNode → GainNode → AnalyserNode → destination
 *
 * Note: BufferSource is one-shot; we recreate it on each play/seek/track change.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private playlist: Track[] = []
  private trackIndex = 0
  private loadState: LoadState = 'idle'
  private error: string | null = null
  private unlocked = false
  private startedAt = 0
  private offset = 0
  private playing = false
  private duration = 0
  private freqData: Uint8Array<ArrayBuffer> | null = null
  private timeData: Uint8Array<ArrayBuffer> | null = null
  private listeners = new Set<Listener>()
  private prevOverall = 0
  private beatFlash = 0
  /** Cached for useSyncExternalStore (must be referentially stable until emit). */
  private cachedSnap: EngineSnapshot

  constructor(playlist: Track[]) {
    this.playlist = playlist
    this.cachedSnap = this.buildSnapshot()
  }

  getPlaylist(): Track[] {
    return this.playlist
  }

  /**
   * Swap the active set (genre booth / mix / custom).
   * Resets transport and optionally autoplays the first track.
   */
  async setPlaylist(tracks: Track[], autoplay = true): Promise<void> {
    this.stopSource(true)
    this.playing = false
    this.offset = 0
    this.trackIndex = 0
    this.beatFlash = 0
    this.prevOverall = 0
    this.playlist = tracks
    this.duration = 0
    this.error = null

    if (tracks.length === 0) {
      this.loadState = 'idle'
      this.emit()
      return
    }

    this.loadState = 'loading'
    this.emit()
    try {
      await this.preload(0)
      if (autoplay && this.unlocked) await this.play()
      else {
        this.loadState = 'ready'
        this.emit()
      }
    } catch {
      /* snapshot already has error */
    }
  }

  /** Inject a decoded buffer directly (used when custom file was just read). */
  cacheBuffer(trackId: string, buffer: AudioBuffer): void {
    this.buffers.set(trackId, buffer)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.cachedSnap)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    this.cachedSnap = this.buildSnapshot()
    for (const fn of this.listeners) fn(this.cachedSnap)
  }

  /** Stable snapshot reference — do not allocate on every read. */
  snapshot(): EngineSnapshot {
    return this.cachedSnap
  }

  private buildSnapshot(): EngineSnapshot {
    return {
      loadState: this.loadState,
      trackIndex: this.trackIndex,
      currentTime: this.getCurrentTime(),
      duration: this.duration,
      error: this.error,
      unlocked: this.unlocked,
    }
  }

  getCurrentTime(): number {
    if (!this.ctx || !this.playing) return this.offset
    return Math.min(
      this.duration,
      this.offset + (this.ctx.currentTime - this.startedAt),
    )
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  getBeatFlash(): number {
    return this.beatFlash
  }

  /** Call from a user gesture (click/tap) before any playback. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0.9
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = AUDIO.fftSize
      this.analyser.smoothingTimeConstant = AUDIO.smoothing
      this.gain.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeData = new Uint8Array(this.analyser.fftSize)
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    this.unlocked = true
    this.emit()
  }

  async preload(index = this.trackIndex): Promise<void> {
    const track = this.playlist[index]
    if (!track) return
    if (this.buffers.has(track.id)) return
    if (!this.ctx) await this.unlock()
    if (!this.ctx) throw new Error('AudioContext unavailable')

    this.loadState = 'loading'
    this.error = null
    this.emit()

    try {
      const res = await fetch(track.src)
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${track.src}`)
      const raw = await res.arrayBuffer()
      const copy = raw.slice(0)
      const buffer = await this.ctx.decodeAudioData(copy)
      this.buffers.set(track.id, buffer)
      if (index === this.trackIndex) {
        this.duration = buffer.duration
        this.loadState = this.playing ? 'playing' : 'ready'
      }
      this.emit()
    } catch (err) {
      this.loadState = 'error'
      this.error =
        err instanceof Error
          ? err.message
          : 'Failed to decode audio. Try another track.'
      this.emit()
      throw err
    }
  }

  async preloadAll(): Promise<void> {
    for (let i = 0; i < this.playlist.length; i++) {
      try {
        await this.preload(i)
      } catch {
        // Keep going — individual track errors are surfaced via snapshot
      }
    }
  }

  async play(): Promise<void> {
    await this.unlock()
    await this.preload(this.trackIndex)
    const track = this.playlist[this.trackIndex]
    const buffer = track ? this.buffers.get(track.id) : undefined
    if (!buffer || !this.ctx || !this.gain) {
      this.loadState = 'error'
      this.error = 'No buffer ready'
      this.emit()
      return
    }

    this.stopSource(false)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.gain)
    src.onended = () => {
      if (!this.playing) return
      if (this.getCurrentTime() >= this.duration - 0.05) {
        void this.next(true)
      }
    }
    const when = 0
    const offset = Math.min(this.offset, Math.max(0, buffer.duration - 0.05))
    src.start(when, offset)
    this.source = src
    this.startedAt = this.ctx.currentTime
    this.offset = offset
    this.playing = true
    this.duration = buffer.duration
    this.loadState = 'playing'
    this.emit()
  }

  pause(): void {
    if (!this.playing) return
    this.offset = this.getCurrentTime()
    this.playing = false
    this.stopSource(false)
    this.loadState = 'paused'
    this.emit()
  }

  toggle(): void {
    if (this.playing) this.pause()
    else void this.play()
  }

  async seek(time: number): Promise<void> {
    this.offset = Math.max(0, Math.min(time, this.duration || time))
    if (this.playing) await this.play()
    else this.emit()
  }

  async select(index: number, autoplay = true): Promise<void> {
    if (index < 0 || index >= this.playlist.length) return
    this.stopSource(false)
    this.playing = false
    this.offset = 0
    this.trackIndex = index
    this.beatFlash = 0
    this.prevOverall = 0
    this.loadState = 'loading'
    this.emit()
    try {
      await this.preload(index)
      if (autoplay) await this.play()
      else {
        const track = this.playlist[index]
        const buf = track && this.buffers.get(track.id)
        this.duration = buf?.duration ?? 0
        this.loadState = 'ready'
        this.emit()
      }
    } catch {
      /* error already in snapshot */
    }
  }

  async next(autoplay = true): Promise<void> {
    if (this.playlist.length === 0) return
    const next = (this.trackIndex + 1) % this.playlist.length
    await this.select(next, autoplay)
  }

  async prev(autoplay = true): Promise<void> {
    if (this.playlist.length === 0) return
    const prev =
      (this.trackIndex - 1 + this.playlist.length) % this.playlist.length
    await this.select(prev, autoplay)
  }

  isPlaying(): boolean {
    return this.playing
  }

  /**
   * Sample analyser bands once per frame (called from PerformanceLoop).
   * Also updates a cheap onset / energy-spike flash.
   */
  sampleBands(dt: number): BandEnergy {
    const empty = { bass: 0, mid: 0, high: 0, overall: 0 }
    if (!this.analyser || !this.freqData || !this.playing) {
      this.beatFlash = Math.max(0, this.beatFlash - dt * 4)
      return empty
    }

    this.analyser.getByteFrequencyData(this.freqData)
    const bass = averageRange(
      this.freqData,
      AUDIO.bassBins[0],
      AUDIO.bassBins[1],
    )
    const mid = averageRange(this.freqData, AUDIO.midBins[0], AUDIO.midBins[1])
    const high = averageRange(
      this.freqData,
      AUDIO.highBins[0],
      AUDIO.highBins[1],
    )
    const overall = bass * 0.5 + mid * 0.35 + high * 0.15

    // Energy spike / onset approximation (not perfect beat tracking)
    const delta = overall - this.prevOverall
    if (delta > 0.08 && overall > 0.22) {
      this.beatFlash = 1
    } else {
      this.beatFlash = Math.max(0, this.beatFlash - dt * 5)
    }
    this.prevOverall = overall * 0.6 + this.prevOverall * 0.4

    return { bass, mid, high, overall }
  }

  sampleWaveform(): Uint8Array | null {
    if (!this.analyser || !this.timeData) return null
    this.analyser.getByteTimeDomainData(this.timeData)
    return this.timeData
  }

  private stopSource(resetOffset: boolean) {
    if (this.source) {
      try {
        this.source.onended = null
        this.source.stop()
      } catch {
        /* already stopped */
      }
      this.source.disconnect()
      this.source = null
    }
    if (resetOffset) this.offset = 0
  }

  dispose(): void {
    this.stopSource(true)
    this.playing = false
    void this.ctx?.close()
    this.ctx = null
    this.listeners.clear()
  }
}

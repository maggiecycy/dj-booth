import { AUDIO } from '../config'
import { averageRange, type BandEnergy } from './analysis'
import { prefersMediaElementPlayback } from './platformAudio'
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
 * AudioEngine — Web Audio playback with AnalyserNode-driven visuals.
 *
 * Desktop: decodeAudioData → AudioBufferSourceNode
 * iOS: HTMLAudioElement → MediaElementSource (Safari blocks silent BufferSource)
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private mediaEl: HTMLAudioElement | null = null
  private mediaSource: MediaElementAudioSourceNode | null = null
  private readonly useMediaElement = prefersMediaElementPlayback()
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
  private cachedSnap: EngineSnapshot

  constructor(playlist: Track[]) {
    this.playlist = playlist
    this.cachedSnap = this.buildSnapshot()
  }

  usesMediaElement(): boolean {
    return this.useMediaElement
  }

  getPlaylist(): Track[] {
    return this.playlist
  }

  /** Assign tracks without stopping playback (used before iOS kickstart). */
  assignPlaylist(tracks: Track[], index = 0): void {
    this.playlist = tracks
    this.trackIndex = Math.min(index, Math.max(0, tracks.length - 1))
    this.offset = 0
    this.duration = 0
    this.error = null
    this.loadState = tracks.length === 0 ? 'idle' : 'ready'
    this.emit()
  }

  /**
   * Synchronous — call at the start of a tap/click handler (before any await).
   * Required on iOS so audio routes to the media channel.
   */
  beginFromUserGesture(): void {
    this.ensureContext()
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume()
    }
    if (this.useMediaElement) {
      this.ensureMediaElement()
    } else {
      this.playSilentBuffer()
    }
    this.unlocked = true
    this.emit()
  }

  /**
   * Start the current track synchronously inside a user gesture (iOS autoplay).
   */
  kickstartFromUserGesture(): void {
    if (!this.useMediaElement || this.playlist.length === 0) return
    this.beginFromUserGesture()
    const track = this.playlist[this.trackIndex]
    if (!track || !this.mediaEl) return

    this.attachMediaHandlers()
    this.mediaEl.src = track.src
    this.mediaEl.currentTime = this.offset
    void this.mediaEl.play().catch(() => {
      this.loadState = 'error'
      this.error = 'Tap play to start audio (iOS)'
      this.emit()
    })
    this.playing = true
    this.loadState = 'playing'
    this.emit()
  }

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
      if (this.useMediaElement) {
        if (autoplay && this.unlocked) {
          await this.play()
        } else {
          this.loadState = 'ready'
          this.emit()
        }
        return
      }

      await this.preload(0)
      this.preloadNext()
      if (autoplay && this.unlocked) await this.play()
      else {
        this.loadState = 'ready'
        this.emit()
      }
    } catch {
      /* snapshot already has error */
    }
  }

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
    if (this.useMediaElement && this.mediaEl && this.playing) {
      return Math.min(this.duration || Infinity, this.mediaEl.currentTime)
    }
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

  async unlock(): Promise<void> {
    this.beginFromUserGesture()
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  async preload(index = this.trackIndex, background = false): Promise<void> {
    if (this.useMediaElement) return

    const track = this.playlist[index]
    if (!track) return
    if (this.buffers.has(track.id)) return
    if (!this.ctx) await this.unlock()
    if (!this.ctx) throw new Error('AudioContext unavailable')

    if (!background) {
      this.loadState = 'loading'
      this.error = null
      this.emit()
    }

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
        this.emit()
      }
    } catch (err) {
      if (!background) {
        this.loadState = 'error'
        this.error =
          err instanceof Error
            ? err.message
            : 'Failed to decode audio. Try another track.'
        this.emit()
      }
      throw err
    }
  }

  preloadNext(): void {
    if (this.useMediaElement || this.playlist.length <= 1) return
    const next = (this.trackIndex + 1) % this.playlist.length
    void this.preload(next, true).catch(() => {})
  }

  async play(): Promise<void> {
    this.beginFromUserGesture()
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume()
    }

    if (this.useMediaElement) {
      await this.playMediaElement()
      return
    }

    await this.preload(this.trackIndex)
    const track = this.playlist[this.trackIndex]
    const buffer = track ? this.buffers.get(track.id) : undefined
    if (!buffer || !this.ctx || !this.gain) {
      this.loadState = 'error'
      this.error = 'No buffer ready'
      this.emit()
      return
    }

    this.stopBufferSource(false)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.gain)
    src.onended = () => {
      if (!this.playing) return
      if (this.getCurrentTime() >= this.duration - 0.05) {
        void this.next(true)
      }
    }
    const offset = Math.min(this.offset, Math.max(0, buffer.duration - 0.05))
    src.start(0, offset)
    this.source = src
    this.startedAt = this.ctx.currentTime
    this.offset = offset
    this.playing = true
    this.duration = buffer.duration
    this.loadState = 'playing'
    this.emit()
    this.preloadNext()
  }

  private async playMediaElement(): Promise<void> {
    const track = this.playlist[this.trackIndex]
    if (!track) return

    this.ensureContext()
    this.ensureMediaElement()
    if (!this.mediaEl || !this.ctx) return

    this.attachMediaHandlers()
    this.loadState = 'loading'
    this.error = null
    this.emit()

    const absoluteSrc = new URL(track.src, window.location.href).href
    if (this.mediaEl.src !== absoluteSrc) {
      this.mediaEl.src = track.src
      await new Promise<void>((resolve, reject) => {
        if (!this.mediaEl) return reject(new Error('No media element'))
        const el = this.mediaEl
        const onReady = () => {
          cleanup()
          resolve()
        }
        const onErr = () => {
          cleanup()
          reject(new Error(`Could not load ${track.title}`))
        }
        const cleanup = () => {
          el.removeEventListener('loadedmetadata', onReady)
          el.removeEventListener('error', onErr)
        }
        if (el.readyState >= 1) {
          resolve()
          return
        }
        el.addEventListener('loadedmetadata', onReady)
        el.addEventListener('error', onErr)
      })
    }

    this.mediaEl.currentTime = this.offset
    try {
      await this.mediaEl.play()
    } catch (err) {
      this.loadState = 'error'
      this.error =
        err instanceof Error ? err.message : 'Playback blocked — tap play again'
      this.emit()
      throw err
    }

    this.duration = this.mediaEl.duration || 0
    this.playing = true
    this.loadState = 'playing'
    this.emit()
  }

  pause(): void {
    if (!this.playing) return

    if (this.useMediaElement && this.mediaEl) {
      this.offset = this.mediaEl.currentTime
      this.mediaEl.pause()
    } else {
      this.offset = this.getCurrentTime()
      this.stopBufferSource(false)
    }

    this.playing = false
    this.loadState = 'paused'
    this.emit()
  }

  toggle(): void {
    if (this.playing) this.pause()
    else void this.play()
  }

  async seek(time: number): Promise<void> {
    this.offset = Math.max(0, Math.min(time, this.duration || time))
    if (this.useMediaElement && this.mediaEl) {
      this.mediaEl.currentTime = this.offset
    }
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
      if (this.useMediaElement) {
        if (autoplay) await this.play()
        else {
          this.loadState = 'ready'
          this.emit()
        }
        return
      }

      await this.preload(index)
      this.preloadNext()
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

  private ensureContext(): void {
    if (this.ctx) return
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

  private ensureMediaElement(): void {
    this.ensureContext()
    if (this.mediaEl || !this.ctx || !this.gain) return

    const el = new Audio()
    el.preload = 'auto'
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    this.mediaEl = el
    this.mediaSource = this.ctx.createMediaElementSource(el)
    this.mediaSource.connect(this.gain)
  }

  private attachMediaHandlers(): void {
    if (!this.mediaEl) return
    this.mediaEl.onended = () => {
      if (!this.playing) return
      if (this.getCurrentTime() >= this.duration - 0.05) {
        void this.next(true)
      }
    }
    this.mediaEl.onloadedmetadata = () => {
      if (!this.mediaEl) return
      this.duration = this.mediaEl.duration || this.duration
      this.emit()
    }
  }

  private playSilentBuffer(): void {
    if (!this.ctx) return
    const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    const ping = this.ctx.createBufferSource()
    ping.buffer = buffer
    ping.connect(this.ctx.destination)
    ping.start(0)
    ping.stop(this.ctx.currentTime + 0.001)
  }

  private stopBufferSource(resetOffset: boolean) {
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

  private stopSource(resetOffset: boolean) {
    if (this.useMediaElement && this.mediaEl) {
      this.mediaEl.onended = null
      this.mediaEl.pause()
      if (resetOffset) this.mediaEl.currentTime = 0
    } else {
      this.stopBufferSource(resetOffset)
    }
    if (resetOffset) this.offset = 0
  }

  dispose(): void {
    this.stopSource(true)
    this.playing = false
    this.mediaEl = null
    this.mediaSource = null
    void this.ctx?.close()
    this.ctx = null
    this.listeners.clear()
  }
}

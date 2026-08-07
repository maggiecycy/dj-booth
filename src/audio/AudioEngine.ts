import { AUDIO } from '../config'
import { averageRange, type BandEnergy } from './analysis'
import { prefersMediaElementPlayback } from './platformAudio'
import type { Track } from './playlist'
import {
  getSpotifyPlaybackState,
  pauseSpotifyPlayback,
  playSpotifyUri,
  seekSpotifyPlayback,
} from '../spotify/player'
import { getValidAccessToken } from '../spotify/auth'
import {
  buildProceduralTimeline,
  sampleAnalysisMotion,
  sampleAnalysisSpectrum,
  sampleAnalysisWaveform,
  trackIdFromSpotifyUri,
  type AnalysisMotionSample,
  type AnalysisTimeline,
} from '../spotify/audioAnalysis'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'playing' | 'paused'

function isSpotifyTrack(track: Track | null | undefined): boolean {
  return Boolean(track?.spotifyUri || track?.src.startsWith('spotify:'))
}

function spotifyUriOf(track: Track): string {
  return track.spotifyUri || track.src
}

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
  /** Spotify Web Playback SDK mode */
  private spotifyMode = false
  private spotifyPosMs = 0
  private spotifyPosAt = 0
  private spotifyPoll = 0 as ReturnType<typeof setInterval> | 0
  /** Beats/sections timeline — Spotify API or procedural fallback */
  private spotifyTimeline: AnalysisTimeline | null = null
  private spotifyTimelineTrackId: string | null = null
  private spotifyMotionSample: AnalysisMotionSample | null = null

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
    if (isSpotifyTrack(track)) {
      void this.playSpotify(track)
      return
    }

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
    this.spotifyPosMs = 0
    this.trackIndex = 0
    this.beatFlash = 0
    this.prevOverall = 0
    this.playlist = tracks
    this.duration = tracks[0]?.durationSec ?? 0
    this.error = null

    if (tracks.length === 0) {
      this.loadState = 'idle'
      this.emit()
      return
    }

    this.loadState = 'loading'
    this.emit()

    try {
      if (isSpotifyTrack(tracks[0])) {
        if (autoplay && this.unlocked) await this.play()
        else {
          this.loadState = 'ready'
          this.emit()
        }
        return
      }

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
    if (this.spotifyMode) {
      if (!this.playing) return this.spotifyPosMs / 1000
      const elapsed = (performance.now() - this.spotifyPosAt) / 1000
      return Math.min(this.duration || Infinity, this.spotifyPosMs / 1000 + elapsed)
    }
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
    if (track.spotifyUri || track.src.startsWith('spotify:')) {
      // Spotify URIs need Web Playback SDK — not fetch()/decodeAudioData
      if (!background) {
        this.duration = 0
        this.loadState = this.playing ? 'playing' : 'ready'
        this.error = null
        this.emit()
      }
      return
    }
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

    const track = this.playlist[this.trackIndex]
    if (isSpotifyTrack(track)) {
      await this.playSpotify(track!)
      return
    }

    // Leaving Spotify mode for local audio
    if (this.spotifyMode) {
      await pauseSpotifyPlayback().catch(() => {})
      this.stopSpotifyPoll()
      this.spotifyMode = false
    }

    if (this.useMediaElement) {
      await this.playMediaElement()
      return
    }

    await this.preload(this.trackIndex)
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

  private async playSpotify(track: Track): Promise<void> {
    this.stopBufferSource(false)
    if (this.mediaEl) {
      this.mediaEl.pause()
    }

    this.loadState = 'loading'
    this.error = null
    this.emit()

    const uri = spotifyUriOf(track)
    const positionMs = Math.floor(this.offset * 1000)

    const token = await getValidAccessToken()
    if (!token) {
      this.spotifyMode = false
      this.playing = false
      this.loadState = 'ready'
      this.error = 'Connect Spotify in Library, then Enable player, then Play.'
      this.emit()
      return
    }

    try {
      await playSpotifyUri(uri, positionMs)

      this.spotifyMode = true
      this.spotifyPosMs = positionMs
      this.spotifyPosAt = performance.now()
      this.duration = track.durationSec ?? this.duration
      this.playing = true
      this.loadState = 'playing'
      this.emit()
      this.startSpotifyPoll()
      this.bindSpotifyTimeline(track)

      window.setTimeout(() => {
        void this.syncFromSpotifyPlayer()
      }, 600)
    } catch (err) {
      this.spotifyMode = false
      this.playing = false
      this.loadState = 'ready'
      // Never navigate away — that stole the first “Connect Spotify” click UX
      this.error =
        (err instanceof Error ? err.message : 'Browser player unavailable') +
        ' — Enable player in Library (Premium), or Log out → Connect again.'
      this.emit()
    }
  }

  /** BPM + duration arrangement — no Spotify analysis API (403 for most apps). */
  private bindSpotifyTimeline(track: Track): AnalysisTimeline {
    const trackId = trackIdFromSpotifyUri(spotifyUriOf(track)) || track.id
    if (this.spotifyTimeline && this.spotifyTimelineTrackId === trackId) {
      return this.spotifyTimeline
    }
    const timeline = buildProceduralTimeline(
      trackId,
      track.bpmHint ?? 120,
      track.durationSec ?? (this.duration || 210),
    )
    this.spotifyTimeline = timeline
    this.spotifyTimelineTrackId = trackId
    return timeline
  }

  private ensureSpotifyTimelineSync(): AnalysisTimeline {
    const track = this.playlist[this.trackIndex]
    if (!track) {
      return buildProceduralTimeline('unknown', 120, this.duration || 210)
    }
    return this.bindSpotifyTimeline(track)
  }

  private startSpotifyPoll(): void {
    this.stopSpotifyPoll()
    this.spotifyPoll = setInterval(() => {
      void this.syncFromSpotifyPlayer()
    }, 800)
  }

  private stopSpotifyPoll(): void {
    if (this.spotifyPoll) {
      clearInterval(this.spotifyPoll)
      this.spotifyPoll = 0
    }
  }

  private async syncFromSpotifyPlayer(): Promise<void> {
    if (!this.spotifyMode) return
    try {
      const state = await getSpotifyPlaybackState()
      if (!state) return

      if (state.duration > 0) {
        this.duration = state.duration / 1000
      }
      this.spotifyPosMs = state.position
      this.spotifyPosAt = performance.now()

      if (state.paused && this.playing) {
        this.playing = false
        this.offset = state.position / 1000
        this.loadState = 'paused'
        this.emit()
        return
      }

      if (
        this.playing &&
        state.duration > 0 &&
        state.position >= state.duration - 800
      ) {
        void this.next(true)
        return
      }

      this.emit()
    } catch {
      /* ignore transient SDK errors */
    }
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

    if (this.spotifyMode) {
      this.spotifyPosMs = this.getCurrentTime() * 1000
      this.offset = this.spotifyPosMs / 1000
      void pauseSpotifyPlayback().catch(() => {})
      this.stopSpotifyPoll()
      this.playing = false
      this.loadState = 'paused'
      this.emit()
      return
    }

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
    if (this.spotifyMode) {
      this.spotifyPosMs = this.offset * 1000
      this.spotifyPosAt = performance.now()
      await seekSpotifyPlayback(this.spotifyPosMs).catch(() => {})
      this.emit()
      return
    }
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
    this.spotifyPosMs = 0
    this.trackIndex = index
    this.beatFlash = 0
    this.prevOverall = 0
    this.spotifyMotionSample = null
    this.spotifyTimeline = null
    this.spotifyTimelineTrackId = null
    this.loadState = 'loading'
    this.emit()

    const track = this.playlist[index]
    try {
      if (isSpotifyTrack(track)) {
        this.duration = track?.durationSec ?? 0
        this.bindSpotifyTimeline(track!)
        if (autoplay) await this.play()
        else {
          this.loadState = 'ready'
          this.emit()
        }
        return
      }

      if (this.spotifyMode) {
        await pauseSpotifyPlayback().catch(() => {})
        this.stopSpotifyPoll()
        this.spotifyMode = false
      }

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

    // Spotify SDK audio is not in AnalyserNode — drive from analysis timeline
    if (this.spotifyMode && this.playing) {
      const timeline = this.ensureSpotifyTimelineSync()
      const sample = sampleAnalysisMotion(
        timeline,
        this.getCurrentTime(),
        dt,
        this.beatFlash,
      )
      this.spotifyMotionSample = sample
      this.beatFlash = sample.beatFlash
      this.prevOverall = sample.bands.overall
      return sample.bands
    }

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

  /**
   * Frequency bars 0…1 across the musical range (not left-heavy).
   * Draw layer can mirror bass to center for aesthetic styles.
   */
  sampleSpectrum(barCount: number): number[] {
    const n = Math.max(16, Math.min(128, Math.floor(barCount)))
    const out = new Array<number>(n).fill(0)

    if (this.spotifyMode && this.playing) {
      const motion =
        this.spotifyMotionSample ??
        sampleAnalysisMotion(
          this.ensureSpotifyTimelineSync(),
          this.getCurrentTime(),
          0,
          this.beatFlash,
        )
      return sampleAnalysisSpectrum(motion, n, this.getCurrentTime())
    }

    if (!this.analyser || !this.freqData || !this.playing) return out

    this.analyser.getByteFrequencyData(this.freqData)
    const bins = this.freqData.length
    // Use the lower ~45% of bins (where music energy lives), sampled evenly
    const usable = Math.max(32, Math.floor(bins * 0.45))
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = (i + 1) / n
      const start = Math.floor(t0 * usable)
      const end = Math.max(start + 1, Math.floor(t1 * usable))
      let sum = 0
      for (let j = start; j < end; j++) sum += this.freqData[j]!
      // Gentle curve so quiet tracks still read
      const raw = sum / (end - start) / 255
      out[i] = Math.min(1, Math.pow(raw, 0.85) * 1.25)
    }
    return out
  }

  /** Normalized waveform samples −1…1 for ribbon / oscilloscope styles. */
  sampleWaveformNorm(sampleCount: number): number[] {
    const n = Math.max(32, Math.min(256, Math.floor(sampleCount)))
    const out = new Array<number>(n).fill(0)

    if (this.spotifyMode && this.playing) {
      const motion =
        this.spotifyMotionSample ??
        sampleAnalysisMotion(
          this.ensureSpotifyTimelineSync(),
          this.getCurrentTime(),
          0,
          this.beatFlash,
        )
      return sampleAnalysisWaveform(motion, n, this.getCurrentTime())
    }

    if (!this.analyser || !this.timeData || !this.playing) return out
    this.analyser.getByteTimeDomainData(this.timeData)
    const len = this.timeData.length
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((i / n) * len)
      out[i] = ((this.timeData[idx] ?? 128) - 128) / 128
    }
    return out
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
    if (this.spotifyMode) {
      void pauseSpotifyPlayback().catch(() => {})
      this.stopSpotifyPoll()
      this.spotifyMode = false
    }
    if (this.useMediaElement && this.mediaEl) {
      this.mediaEl.onended = null
      this.mediaEl.pause()
      if (resetOffset) this.mediaEl.currentTime = 0
    } else {
      this.stopBufferSource(resetOffset)
    }
    if (resetOffset) {
      this.offset = 0
      this.spotifyPosMs = 0
    }
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

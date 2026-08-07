/**
 * Procedural arrangement for Spotify playback.
 *
 * Spotify Web Playback SDK audio never reaches AnalyserNode, and
 * GET /audio-analysis is blocked (403) for most apps since 2024-11.
 * We drive lights / bounce from BPM + duration sections instead — no API calls.
 */

import type { BandEnergy } from '../audio/analysis'

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'build'
  | 'drop'
  | 'breakdown'
  | 'outro'
  | 'unknown'

export interface AnalysisSection {
  start: number
  duration: number
  loudness: number
  tempo: number
  kind: SectionKind
  /** 0..1 relative energy vs track */
  energy: number
}

export interface AnalysisTimeline {
  trackId: string
  duration: number
  tempo: number
  beats: number[]
  bars: number[]
  sections: AnalysisSection[]
}

export interface AnalysisMotionSample {
  bands: BandEnergy
  beatFlash: number
  sectionKind: SectionKind
  sectionEnergy: number
  /** 0..1 progress through current bar */
  barPhase: number
}

export function trackIdFromSpotifyUri(uri: string): string | null {
  const m = /^spotify:track:([a-zA-Z0-9]+)$/.exec(uri)
  return m?.[1] ?? null
}

/** Club-form timeline from BPM + duration (intro → build → drop → …). */
export function buildProceduralTimeline(
  trackId: string,
  bpm: number,
  durationSec: number,
): AnalysisTimeline {
  const tempo = Math.max(70, Math.min(180, bpm || 120))
  const duration = Math.max(60, durationSec || 210)
  const beatDur = 60 / tempo
  const barDur = beatDur * 4

  const beats: number[] = []
  for (let t = 0; t < duration; t += beatDur) beats.push(t)

  const bars: number[] = []
  for (let t = 0; t < duration; t += barDur) bars.push(t)

  const plan: { frac: number; kind: SectionKind; energy: number }[] = [
    { frac: 0.08, kind: 'intro', energy: 0.28 },
    { frac: 0.18, kind: 'verse', energy: 0.48 },
    { frac: 0.1, kind: 'build', energy: 0.62 },
    { frac: 0.16, kind: 'drop', energy: 0.92 },
    { frac: 0.1, kind: 'breakdown', energy: 0.32 },
    { frac: 0.08, kind: 'build', energy: 0.7 },
    { frac: 0.18, kind: 'drop', energy: 0.95 },
    { frac: 0.12, kind: 'outro', energy: 0.4 },
  ]

  const sections: AnalysisSection[] = []
  let cursor = 0
  for (const p of plan) {
    const dur = duration * p.frac
    sections.push({
      start: cursor,
      duration: dur,
      loudness: -20 + p.energy * 16,
      tempo,
      kind: p.kind,
      energy: p.energy,
    })
    cursor += dur
  }

  return { trackId, duration, tempo, beats, bars, sections }
}

/** Sample reactive bands at playback time using beats + section energy. */
export function sampleAnalysisMotion(
  timeline: AnalysisTimeline,
  timeSec: number,
  dt: number,
  prevFlash: number,
): AnalysisMotionSample {
  const t = Math.max(0, timeSec)
  const section = sectionAt(timeline.sections, t)
  const kind = section?.kind ?? 'verse'
  const sectionEnergy = section?.energy ?? 0.5
  const tempo = section?.tempo || timeline.tempo || 120
  const beatDur = 60 / tempo

  const beatIdx = nearestBeatIndex(timeline.beats, t)
  const beatT = beatIdx >= 0 ? timeline.beats[beatIdx]! : Math.floor(t / beatDur) * beatDur
  const sinceBeat = t - beatT
  const beatEnv = Math.exp(-sinceBeat * (kind === 'drop' ? 9 : 7))
  const onBeat = sinceBeat >= 0 && sinceBeat < beatDur * 0.22

  const barIdx = nearestBeatIndex(timeline.bars, t)
  const barStart =
    barIdx >= 0 ? timeline.bars[barIdx]! : Math.floor(t / (beatDur * 4)) * beatDur * 4
  const nextBar =
    barIdx >= 0 && barIdx + 1 < timeline.bars.length
      ? timeline.bars[barIdx + 1]!
      : barStart + beatDur * 4
  const barPhase = nextBar > barStart ? (t - barStart) / (nextBar - barStart) : 0

  let buildRamp = 1
  if (kind === 'build' && section) {
    buildRamp =
      0.55 + 0.55 * Math.min(1, (t - section.start) / Math.max(0.01, section.duration))
  }

  const kindMul = kindMultiplier(kind)
  const pulse = beatEnv * kindMul.buildKick
  const hat =
    Math.pow(Math.max(0, Math.sin((sinceBeat / beatDur) * Math.PI * 2)), 3) *
    kindMul.hat *
    (0.35 + sectionEnergy * 0.65)

  const bass = clamp01(
    (0.18 + sectionEnergy * 0.35) * kindMul.bassFloor + pulse * 0.72 * buildRamp,
  )
  const mid = clamp01(
    0.14 +
      sectionEnergy * 0.4 * kindMul.mid +
      hat * 0.55 +
      (kind === 'build' ? barPhase * 0.2 : 0),
  )
  const high = clamp01(
    0.1 +
      sectionEnergy * 0.28 * kindMul.high +
      hat * 0.4 +
      (kind === 'breakdown' ? 0.08 : 0) +
      (kind === 'drop' ? pulse * 0.15 : 0),
  )
  const overall = bass * 0.5 + mid * 0.35 + high * 0.15

  let beatFlash = Math.max(0, prevFlash - dt * 5)
  if (onBeat && beatEnv > 0.55) {
    beatFlash = kind === 'drop' || kind === 'build' ? 1 : 0.75
  }
  if (barPhase < 0.04 && sinceBeat < beatDur * 0.15) {
    beatFlash = Math.max(beatFlash, 0.9)
  }

  return {
    bands: { bass, mid, high, overall },
    beatFlash,
    sectionKind: kind,
    sectionEnergy,
    barPhase: clamp01(barPhase),
  }
}

export function sampleAnalysisSpectrum(
  sample: AnalysisMotionSample,
  barCount: number,
  timeSec: number,
): number[] {
  const n = Math.max(16, Math.min(128, Math.floor(barCount)))
  const out = new Array<number>(n).fill(0)
  const { bands, sectionKind, barPhase } = sample
  const shimmer = 0.5 + 0.5 * Math.sin(timeSec * 6 + barPhase * Math.PI * 2)

  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const env = Math.sin(t * Math.PI) ** 0.65
    const bassW = Math.exp(-Math.pow((t - 0.2) / 0.28, 2))
    const midW = Math.exp(-Math.pow((t - 0.5) / 0.22, 2))
    const highW = Math.exp(-Math.pow((t - 0.78) / 0.25, 2))
    let v =
      bands.bass * bassW * 0.9 +
      bands.mid * midW * 0.85 +
      bands.high * highW * 0.8 +
      bands.overall * env * 0.25

    if (sectionKind === 'build') v *= 0.75 + barPhase * 0.45
    if (sectionKind === 'breakdown') v *= 0.55 + highW * 0.5
    if (sectionKind === 'drop') v *= 1.05 + shimmer * 0.08

    out[i] = clamp01(v * (0.4 + env * 0.7))
  }
  return out
}

export function sampleAnalysisWaveform(
  sample: AnalysisMotionSample,
  sampleCount: number,
  timeSec: number,
): number[] {
  const n = Math.max(32, Math.min(256, Math.floor(sampleCount)))
  const out = new Array<number>(n).fill(0)
  const amp = 0.25 + sample.bands.overall * 0.7
  const freq = 4 + sample.sectionEnergy * 6
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const env = Math.sin(t * Math.PI) ** 0.8
    out[i] =
      Math.sin(timeSec * freq + t * Math.PI * 8) * 0.55 * amp * env +
      Math.sin(timeSec * freq * 2 + t * Math.PI * 16) * 0.2 * amp * env
  }
  return out
}

function kindMultiplier(kind: SectionKind) {
  switch (kind) {
    case 'intro':
      return { bassFloor: 0.7, mid: 0.75, high: 0.55, hat: 0.45, buildKick: 0.65 }
    case 'verse':
      return { bassFloor: 1, mid: 1, high: 0.9, hat: 0.85, buildKick: 0.9 }
    case 'build':
      return { bassFloor: 0.85, mid: 1.15, high: 1.2, hat: 1.1, buildKick: 1.05 }
    case 'drop':
      return { bassFloor: 1.25, mid: 1.1, high: 1.05, hat: 1, buildKick: 1.35 }
    case 'breakdown':
      return { bassFloor: 0.45, mid: 0.7, high: 1.15, hat: 0.6, buildKick: 0.4 }
    case 'outro':
      return { bassFloor: 0.65, mid: 0.7, high: 0.6, hat: 0.5, buildKick: 0.55 }
    default:
      return { bassFloor: 1, mid: 1, high: 1, hat: 0.9, buildKick: 1 }
  }
}

function sectionAt(sections: AnalysisSection[], t: number): AnalysisSection | null {
  if (sections.length === 0) return null
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i]!
    if (t >= s.start) return s
  }
  return sections[0]!
}

function nearestBeatIndex(times: number[], t: number): number {
  if (times.length === 0) return -1
  let lo = 0
  let hi = times.length - 1
  if (t < times[0]!) return 0
  if (t >= times[hi]!) return hi
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = times[mid]!
    if (v <= t) {
      if (mid + 1 >= times.length || times[mid + 1]! > t) return mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return Math.max(0, hi)
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

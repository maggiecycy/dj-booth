/**
 * Generates royalty-free procedural house-style WAV demos.
 * Pure synthesis — no third-party samples. Safe to redistribute.
 *
 * Usage: node scripts/generate-demo-tracks.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/music')
const SAMPLE_RATE = 44100

const tracks = [
  { file: 'midnight-pulse.wav', bpm: 122, bars: 8, key: 110, mood: 'warm', title: 'Midnight Pulse' },
  { file: 'soft-grid.wav', bpm: 118, bars: 8, key: 98, mood: 'cool', title: 'Soft Grid' },
  { file: 'afterglow.wav', bpm: 124, bars: 8, key: 130, mood: 'amber', title: 'Afterglow' },
  { file: 'headphone-dance.wav', bpm: 120, bars: 8, key: 87, mood: 'deep', title: 'Headphone Dance' },
  { file: 'late-taxi.wav', bpm: 126, bars: 8, key: 146, mood: 'bright', title: 'Late Taxi' },
  { file: 'rain-on-vinyl.wav', bpm: 116, bars: 8, key: 92, mood: 'mist', title: 'Rain on Vinyl' },
]

function clamp(v, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}

function kick(t) {
  const e = Math.exp(-t * 18)
  const f = 55 * Math.exp(-t * 12) + 35
  return Math.sin(2 * Math.PI * f * t) * e * 1.2
}

function snare(t) {
  const e = Math.exp(-t * 22)
  const tone = Math.sin(2 * Math.PI * 180 * t) * 0.25
  const noise = (Math.random() * 2 - 1) * 0.55
  return (tone + noise) * e
}

function hat(t, open = false) {
  const e = Math.exp(-t * (open ? 8 : 40))
  return (Math.random() * 2 - 1) * e * (open ? 0.22 : 0.14)
}

function bass(t, freq, gate) {
  if (gate <= 0) return 0
  const e = Math.min(1, gate * 8) * Math.exp(-Math.max(0, gate - 0.12) * 3)
  const s = Math.sin(2 * Math.PI * freq * t)
  const s2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.2
  return (s + s2) * e * 0.45
}

function pad(t, freqs, amp) {
  let s = 0
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]
    s += Math.sin(2 * Math.PI * f * t + i) * 0.35
    s += Math.sin(2 * Math.PI * (f * 1.002) * t) * 0.15
  }
  return s * amp * 0.12
}

function chordFor(root, mood, bar) {
  const thirds = mood === 'bright' ? [0, 4, 7, 11] : [0, 3, 7, 10]
  const shift = [0, 5, 7, 5][bar % 4]
  return thirds.map((semi) => root * Math.pow(2, (semi + shift) / 12))
}

function renderTrack(cfg) {
  const beatDur = 60 / cfg.bpm
  const duration = beatDur * 4 * cfg.bars
  const n = Math.floor(duration * SAMPLE_RATE)
  const L = new Float32Array(n)
  const R = new Float32Array(n)

  const bassPattern = [1, 0, 0.6, 0, 1, 0, 0.4, 0.7]
  const hatPattern = [0.4, 0.2, 0.7, 0.2, 0.4, 0.15, 0.8, 0.25]

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const beat = t / beatDur
    const beatIndex = Math.floor(beat)
    const local = beat % 1
    const bar = Math.floor(beatIndex / 4)
    const eighth = Math.floor((beat % 4) * 2) % 8

    let sample = 0

    // Four-on-the-floor kick
    const kickPhase = t % beatDur
    if (kickPhase < 0.2) sample += kick(kickPhase)

    // Snare on 2 and 4
    const beatInBar = beatIndex % 4
    if ((beatInBar === 1 || beatInBar === 3) && local * beatDur < 0.18) {
      sample += snare(local * beatDur) * 0.7
    }

    // Hats
    const eighthPhase = ((t % (beatDur / 2)) )
    const hatAmp = hatPattern[eighth]
    if (eighthPhase < 0.08) {
      sample += hat(eighthPhase, hatAmp > 0.6) * hatAmp
    }

    // Bass
    const bassGate = bassPattern[eighth]
    const bassFreq = cfg.key * (eighth === 4 || eighth === 7 ? 0.75 : 1)
    const bassT = t // continuous for phase continuity via sin of absolute t is ok for demo
    if (bassGate > 0) {
      const gateLen = beatDur / 2
      const g = 1 - eighthPhase / gateLen
      sample += bass(bassT, bassFreq, Math.max(0, g) * bassGate)
    }

    // Pad
    const chords = chordFor(cfg.key * 2, cfg.mood, bar)
    const padAmp = 0.55 + 0.35 * Math.sin(t * 0.4)
    sample += pad(t, chords, padAmp)

    // Soft filter sweep / energy swell every 4 bars
    const swell = 0.85 + 0.15 * Math.sin((bar / 4) * Math.PI * 2)
    sample *= swell

    // Gentle stereo
    const width = 0.12 * Math.sin(2 * Math.PI * 0.15 * t)
    L[i] = clamp(sample * (1 - width) * 0.55)
    R[i] = clamp(sample * (1 + width) * 0.55)
  }

  // Soft fade in/out
  const fade = Math.floor(SAMPLE_RATE * 0.05)
  for (let i = 0; i < fade; i++) {
    const g = i / fade
    L[i] *= g
    R[i] *= g
    L[n - 1 - i] *= g
    R[n - 1 - i] *= g
  }

  return encodeWav(L, R)
}

function encodeWav(left, right) {
  const numSamples = left.length
  const bytesPerSample = 2
  const blockAlign = 2 * bytesPerSample
  const dataSize = numSamples * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(2, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * blockAlign, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  let o = 44
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]))
    const r = Math.max(-1, Math.min(1, right[i]))
    buffer.writeInt16LE((l * 32767) | 0, o)
    buffer.writeInt16LE((r * 32767) | 0, o + 2)
    o += 4
  }
  return buffer
}

fs.mkdirSync(outDir, { recursive: true })
for (const track of tracks) {
  const buf = renderTrack(track)
  const dest = path.join(outDir, track.file)
  fs.writeFileSync(dest, buf)
  console.log(`Wrote ${track.file} (${(buf.length / 1024 / 1024).toFixed(2)} MB) — ${track.title}`)
}
console.log('Done.')

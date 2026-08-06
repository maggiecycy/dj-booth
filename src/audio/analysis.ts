/**
 * Map Analyser frequency aggregates → animation parameters.
 * Keep these pure and readable — this is the audio→visual contract.
 */

export interface BandEnergy {
  bass: number
  mid: number
  high: number
  overall: number
}

export interface MotionParams {
  /** Vertical bounce for knees / body (0..1+) */
  bounce: number
  /** Arm DJ gesture intensity (0..1+) */
  armSwing: number
  /** Deck / light pulse (0..1+) */
  energyPulse: number
  /** Vinyl spin speed multiplier */
  vinylSpeed: number
  /** Brief flash when onset detected */
  beatFlash: number
  /** Hand press on pads */
  padPress: number
}

export function averageRange(
  data: Uint8Array,
  from: number,
  to: number,
): number {
  const end = Math.min(to, data.length - 1)
  const start = Math.min(from, end)
  let sum = 0
  let count = 0
  for (let i = start; i <= end; i++) {
    sum += data[i]
    count++
  }
  return count === 0 ? 0 : sum / count / 255
}

/** Soft knee curve so quiet tracks still move a little, loud ones don't explode. */
export function softClamp(x: number, gain = 1.4, ceiling = 1.15): number {
  const y = x * gain
  return ceiling * (1 - Math.exp(-y))
}

export function mapBassToBounce(bass: number, intensity = 1): number {
  return softClamp(bass, 1.8) * intensity
}

export function mapMidToArm(mid: number, high: number, intensity = 1): number {
  const blend = mid * 0.7 + high * 0.3
  return softClamp(blend, 1.6) * intensity
}

export function mapEnergyToLights(overall: number, intensity = 1): number {
  return softClamp(overall, 1.5, 1.1) * intensity
}

export function mapPlaybackToVinyl(
  playing: boolean,
  overall: number,
  intensity = 1,
): number {
  if (!playing) return 0
  return (0.55 + softClamp(overall, 1.2) * 0.55) * intensity
}

export function mapBandsToMotion(
  bands: BandEnergy,
  playing: boolean,
  intensity: number,
  beatFlash: number,
): MotionParams {
  return {
    bounce: playing ? mapBassToBounce(bands.bass, intensity) : 0,
    armSwing: playing ? mapMidToArm(bands.mid, bands.high, intensity) : 0,
    energyPulse: playing ? mapEnergyToLights(bands.overall, intensity) : 0.15,
    vinylSpeed: mapPlaybackToVinyl(playing, bands.overall, intensity),
    beatFlash: beatFlash * intensity,
    padPress: playing ? softClamp(bands.mid, 1.4) * intensity : 0,
  }
}

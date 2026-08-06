/** User-tunable venue / lighting multipliers (0–1). */
export interface VenueSettings {
  lights: number
  haze: number
  lasers: number
  particles: number
  fog: number
}

export const DEFAULT_VENUE: VenueSettings = {
  lights: 0.55,
  haze: 0.4,
  lasers: 0.45,
  particles: 0.5,
  fog: 0.35,
}

/** Site brand & tunables — change here, not scattered in UI. */
export const SITE = {
  name: 'Night Booth',
  tagline: 'emotional house · headphone dance',
  description:
    'A shareable one-page DJ booth — Web Audio drives the character, decks, and lights.',
} as const

export const AUDIO = {
  fftSize: 2048,
  smoothing: 0.82,
  /** Analyser frequency bins we care about (aggregated, not every bin). */
  bassBins: [1, 6],
  midBins: [12, 40],
  highBins: [50, 120],
} as const

/** Optional CDN origin for catalog MP3s — set VITE_MUSIC_CDN_URL at build time. */
export const MUSIC = {
  cdnBase: (import.meta.env.VITE_MUSIC_CDN_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ),
} as const

export const MOTION = {
  defaultIntensity: 1 as number,
  reducedIntensity: 0.25 as number,
}

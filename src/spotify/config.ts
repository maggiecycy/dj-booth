export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ')

/** Bump when scopes change — forces users to re-consent. */
export const SPOTIFY_AUTH_VERSION = 2

export function spotifyClientId(): string | undefined {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
  return id?.trim() || undefined
}

/** Must match Spotify Dashboard Redirect URIs exactly. */
export function spotifyRedirectUri(): string {
  const fromEnv = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim()

  const base = import.meta.env.BASE_URL
  const path = base.endsWith('/') ? `${base}callback` : `${base}/callback`
  return `${window.location.origin}${path}`
}

export function isSpotifyConfigured(): boolean {
  return Boolean(spotifyClientId())
}

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const SPOTIFY_API = 'https://api.spotify.com/v1'

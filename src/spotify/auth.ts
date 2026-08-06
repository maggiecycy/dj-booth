import {
  isSpotifyConfigured,
  SPOTIFY_AUTH_URL,
  SPOTIFY_AUTH_VERSION,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_URL,
  spotifyClientId,
  spotifyRedirectUri,
} from './config'
import { challengeForVerifier, randomState, randomVerifier } from './pkce'

const TOKEN_STORAGE = 'night-booth-spotify-token-v2'
const PKCE_VERIFIER = 'night-booth-spotify-pkce-verifier'
const OAUTH_STATE = 'night-booth-spotify-oauth-state'
const LEGACY_TOKEN_KEYS = [
  'night-booth-spotify-token-v1',
]

export interface SpotifyTokenBundle {
  accessToken: string
  refreshToken: string
  expiresAt: number
  authVersion?: number
}

export interface SpotifyProfile {
  id: string
  displayName: string
  product: string
  imageUrl?: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

function readToken(): SpotifyTokenBundle | null {
  try {
    for (const key of LEGACY_TOKEN_KEYS) {
      sessionStorage.removeItem(key)
    }
    const raw = sessionStorage.getItem(TOKEN_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SpotifyTokenBundle
    // Old sessions lack streaming / playback scopes — force re-login
    if (parsed.authVersion !== SPOTIFY_AUTH_VERSION) {
      sessionStorage.removeItem(TOKEN_STORAGE)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeToken(bundle: SpotifyTokenBundle): void {
  sessionStorage.setItem(
    TOKEN_STORAGE,
    JSON.stringify({ ...bundle, authVersion: SPOTIFY_AUTH_VERSION }),
  )
}

export function clearSpotifySession(): void {
  sessionStorage.removeItem(TOKEN_STORAGE)
  sessionStorage.removeItem(PKCE_VERIFIER)
  sessionStorage.removeItem(OAUTH_STATE)
}

export function getSpotifyAccessToken(): string | null {
  const t = readToken()
  if (!t) return null
  if (Date.now() >= t.expiresAt - 60_000) return null
  return t.accessToken
}

export async function getValidAccessToken(): Promise<string | null> {
  const existing = readToken()
  if (!existing) return null
  if (Date.now() < existing.expiresAt - 60_000) return existing.accessToken
  if (!existing.refreshToken) {
    clearSpotifySession()
    return null
  }
  try {
    const next = await refreshTokens(existing.refreshToken)
    writeToken(next)
    return next.accessToken
  } catch {
    clearSpotifySession()
    return null
  }
}

async function exchangeToken(body: URLSearchParams): Promise<SpotifyTokenBundle> {
  const clientId = spotifyClientId()
  if (!clientId) throw new Error('Spotify Client ID not configured')

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spotify token error (${res.status}): ${text}`)
  }

  const data = (await res.json()) as TokenResponse
  const prev = readToken()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

async function refreshTokens(refreshToken: string): Promise<SpotifyTokenBundle> {
  const clientId = spotifyClientId()
  if (!clientId) throw new Error('Spotify Client ID not configured')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })
  return exchangeToken(body)
}

export async function startSpotifyLogin(): Promise<void> {
  if (!isSpotifyConfigured()) {
    throw new Error('Add VITE_SPOTIFY_CLIENT_ID to .env.local')
  }

  const verifier = randomVerifier()
  const challenge = await challengeForVerifier(verifier)
  const state = randomState()

  sessionStorage.setItem(PKCE_VERIFIER, verifier)
  sessionStorage.setItem(OAUTH_STATE, state)

  const params = new URLSearchParams({
    client_id: spotifyClientId()!,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  })

  const url = `${SPOTIFY_AUTH_URL}?${params}`
  // Full navigation to authorize only — never open.spotify.com/track
  window.location.href = url
}

export function isOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') || params.has('error')
}

/** Deduplicate StrictMode / remount — auth codes are single-use. */
let oauthInFlight: Promise<boolean> | null = null

export async function completeSpotifyOAuth(): Promise<boolean> {
  if (oauthInFlight) return oauthInFlight

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    clearSpotifySession()
    cleanOAuthUrl()
    throw new Error(`Spotify login cancelled: ${error}`)
  }

  if (!code || !state) return false

  // Already exchanged this code (e.g. refresh with stale URL)
  if (readToken() && !sessionStorage.getItem(PKCE_VERIFIER)) {
    cleanOAuthUrl()
    return true
  }

  oauthInFlight = (async () => {
    const expectedState = sessionStorage.getItem(OAUTH_STATE)
    const verifier = sessionStorage.getItem(PKCE_VERIFIER)
    if (!expectedState || state !== expectedState || !verifier) {
      cleanOAuthUrl()
      throw new Error('Spotify login state mismatch — try Connect Spotify again')
    }

    const clientId = spotifyClientId()
    if (!clientId) throw new Error('Spotify Client ID not configured')

    // Strip code from URL before fetch so remounts cannot re-exchange
    cleanOAuthUrl()

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyRedirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    })

    try {
      const bundle = await exchangeToken(body)
      writeToken(bundle)
      sessionStorage.removeItem(PKCE_VERIFIER)
      sessionStorage.removeItem(OAUTH_STATE)
      return true
    } catch (err) {
      sessionStorage.removeItem(PKCE_VERIFIER)
      sessionStorage.removeItem(OAUTH_STATE)
      throw err
    }
  })()

  try {
    return await oauthInFlight
  } finally {
    oauthInFlight = null
  }
}

export function cleanOAuthUrl(): void {
  const base = import.meta.env.BASE_URL
  const root = base.endsWith('/') ? base : `${base}/`
  window.history.replaceState({}, document.title, root)
}

export async function fetchSpotifyProfile(token: string): Promise<SpotifyProfile> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`)

  const data = (await res.json()) as {
    id: string
    display_name: string | null
    product: string
    images?: { url: string }[]
  }

  return {
    id: data.id,
    displayName: data.display_name || 'Spotify user',
    product: data.product,
    imageUrl: data.images?.[0]?.url,
  }
}

export function isSpotifyLoggedIn(): boolean {
  return Boolean(readToken())
}

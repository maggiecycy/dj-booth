import { SPOTIFY_API } from './config'
import { getSpotifyAccessToken, getValidAccessToken } from './auth'

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayerInstance
    }
  }
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (
    event: string,
    cb: (payload: SpotifyPlayerEvent) => void,
  ) => void
  removeListener: (event: string, cb?: (payload: SpotifyPlayerEvent) => void) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  activateElement: () => Promise<void>
}

interface SpotifyPlayerEvent {
  device_id?: string
  message?: string
}

export interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      uri: string
      name: string
      duration_ms: number
    } | null
  }
}

let sdkReadyPromise: Promise<void> | null = null
let player: SpotifyPlayerInstance | null = null
let deviceId: string | null = null
let readyPromise: Promise<string> | null = null
let lastError: string | null = null

export function getSpotifyPlayerError(): string | null {
  return lastError
}

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'))
  }
  if (window.Spotify) return Promise.resolve()
  if (sdkReadyPromise) return sdkReadyPromise

  sdkReadyPromise = new Promise((resolve, reject) => {
    const prev = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      try {
        prev?.()
      } catch {
        /* ignore */
      }
      resolve()
    }

    // Script may already be in DOM from a prior attempt
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    )
    if (existing) {
      if (window.Spotify) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onerror = () => {
      sdkReadyPromise = null
      reject(
        new Error(
          'Could not load Spotify SDK (sdk.scdn.co). Check network / VPN, then refresh.',
        ),
      )
    }
    document.body.appendChild(script)

    window.setTimeout(() => {
      if (!window.Spotify) {
        sdkReadyPromise = null
        reject(
          new Error(
            'Spotify SDK load timeout — sdk.scdn.co blocked or slow. Try VPN / refresh.',
          ),
        )
      }
    }, 20000)
  })

  return sdkReadyPromise
}

/** Prefetch SDK script early (after login). */
export function prefetchSpotifySdk(): void {
  void loadSdk().catch(() => {})
}

async function apiPut(path: string, body?: unknown): Promise<void> {
  const token = await getValidAccessToken()
  if (!token) throw new Error('Spotify session expired — connect again')

  const res = await fetch(`${SPOTIFY_API}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 204 || res.status === 202 || res.ok) return

  const text = await res.text()
  if (res.status === 404) {
    throw new Error(
      'Spotify device not found — click “Enable Spotify player” then Play again',
    )
  }
  if (res.status === 403) {
    throw new Error('Spotify Premium required for Web Playback')
  }
  throw new Error(`Spotify player API (${res.status}): ${text}`)
}

function provideToken(cb: (token: string) => void): void {
  // Prefer sync token so SDK connect does not hang waiting on async
  const sync = getSpotifyAccessToken()
  if (sync) {
    cb(sync)
    return
  }
  void getValidAccessToken().then((t) => cb(t || ''))
}

function resetPlayerInstance(): void {
  try {
    player?.disconnect()
  } catch {
    /* ignore */
  }
  player = null
  deviceId = null
  readyPromise = null
}

/**
 * Connect Web Playback SDK and return device_id.
 * Best called from a click handler (user gesture) via “Enable Spotify player”.
 * @see https://developer.spotify.com/documentation/web-playback-sdk
 */
export async function ensureSpotifyPlayer(): Promise<string> {
  if (deviceId && player) {
    try {
      await player.activateElement()
    } catch {
      /* ok */
    }
    return deviceId
  }
  if (readyPromise) return readyPromise

  lastError = null
  readyPromise = (async () => {
    await loadSdk()

    const token = await getValidAccessToken()
    if (!token) throw new Error('Connect Spotify first')

    // Drop any half-initialized instance
    if (player) resetPlayerInstance()

    player = new window.Spotify.Player({
      name: 'Night Booth',
      getOAuthToken: provideToken,
      volume: 0.9,
    })

    const id = await new Promise<string>((resolve, reject) => {
      let settled = false
      const fail = (msg: string) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        lastError = msg
        reject(new Error(msg))
      }
      const ok = (devId: string) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(devId)
      }

      const timeout = window.setTimeout(() => {
        fail(
          'Spotify player ready timeout. Click “Enable Spotify player” (user gesture), allow autoplay, check Premium, then retry.',
        )
      }, 25000)

      player!.addListener('ready', (ev) => {
        if (ev.device_id) ok(ev.device_id)
        else fail('Spotify ready without device_id')
      })

      player!.addListener('not_ready', () => {
        deviceId = null
      })

      player!.addListener('initialization_error', (ev) => {
        fail(ev.message || 'Spotify player init failed')
      })

      player!.addListener('authentication_error', (ev) => {
        fail(ev.message || 'Spotify auth failed — Log out and Connect again')
      })

      player!.addListener('account_error', (ev) => {
        fail(ev.message || 'Spotify Premium required for Web Playback')
      })

      player!.addListener('playback_error', (ev) => {
        lastError = ev.message || 'Spotify playback error'
      })

      void (async () => {
        try {
          // Must run close to a user gesture when possible
          await player!.activateElement()
        } catch {
          /* older SDK builds may not need this yet */
        }
        try {
          const connected = await player!.connect()
          if (!connected) fail('Spotify player.connect() returned false')
        } catch (err) {
          fail(err instanceof Error ? err.message : 'Spotify connect failed')
        }
      })()
    })

    deviceId = id

    // Register device with Spotify Connect (helps /me/player/play)
    try {
      await apiPut('/me/player', { device_ids: [id], play: false })
    } catch {
      /* transfer optional until first play */
    }

    return id
  })()

  try {
    return await readyPromise
  } catch (err) {
    resetPlayerInstance()
    throw err
  }
}

export async function playSpotifyUri(
  uri: string,
  positionMs = 0,
): Promise<void> {
  const id = await ensureSpotifyPlayer()
  try {
    await player?.activateElement()
  } catch {
    /* ignore */
  }

  await apiPut(`/me/player/play?device_id=${encodeURIComponent(id)}`, {
    uris: [uri],
    position_ms: Math.max(0, Math.floor(positionMs)),
  })
}

export async function pauseSpotifyPlayback(): Promise<void> {
  if (!player) return
  try {
    await player.pause()
  } catch {
    if (deviceId) {
      await apiPut(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`)
    }
  }
}

export async function resumeSpotifyPlayback(): Promise<void> {
  if (!player) return
  try {
    await player.resume()
  } catch {
    if (deviceId) {
      await apiPut(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`)
    }
  }
}

export async function seekSpotifyPlayback(positionMs: number): Promise<void> {
  if (!player) return
  try {
    await player.seek(Math.max(0, Math.floor(positionMs)))
  } catch {
    if (deviceId) {
      await apiPut(
        `/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${encodeURIComponent(deviceId)}`,
      )
    }
  }
}

export async function getSpotifyPlaybackState(): Promise<SpotifyPlaybackState | null> {
  if (!player) return null
  return player.getCurrentState()
}

export function disconnectSpotifyPlayer(): void {
  resetPlayerInstance()
  lastError = null
}

export function trackOpenUrl(uri: string): string {
  // spotify:track:xxxx → https://open.spotify.com/track/xxxx
  const m = /^spotify:(track|album|playlist):([a-zA-Z0-9]+)$/.exec(uri)
  if (m) return `https://open.spotify.com/${m[1]}/${m[2]}`
  return uri
}

export function openInSpotifyApp(uri: string): void {
  window.open(trackOpenUrl(uri), '_blank', 'noopener,noreferrer')
}

export function isSpotifyPlayerReady(): boolean {
  return Boolean(deviceId && player)
}

import { useEffect, useState, type MouseEvent } from 'react'
import {
  fetchPlaylistTracks,
  fetchUserPlaylists,
  LIKED_SONGS_ID,
  type SpotifyPlaylistSummary,
  type SpotifyTrackSummary,
} from '../spotify/api'
import { isSpotifyConfigured } from '../spotify/config'
import {
  disconnectSpotifyPlayer,
  ensureSpotifyPlayer,
  isSpotifyPlayerReady,
  prefetchSpotifySdk,
} from '../spotify/player'
import { useSpotifyAuth } from '../hooks/useSpotifyAuth'

interface SpotifyPanelProps {
  busy: boolean
  onImportTracks: (tracks: SpotifyTrackSummary[]) => Promise<void>
  /** Clear Spotify imports + refresh Custom when user logs out */
  onLogoutCleanup?: () => void | Promise<void>
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function resetBrowseState(
  setPlaylists: (v: SpotifyPlaylistSummary[]) => void,
  setSelectedId: (v: string | null) => void,
  setPreview: (v: SpotifyTrackSummary[]) => void,
  setLocalError: (v: string | null) => void,
  setPlayerReady: (v: boolean) => void,
) {
  setPlaylists([])
  setSelectedId(null)
  setPreview([])
  setLocalError(null)
  setPlayerReady(false)
}

export function SpotifyPanel({
  busy,
  onImportTracks,
  onLogoutCleanup,
}: SpotifyPanelProps) {
  const spotify = useSpotifyAuth()
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<SpotifyTrackSummary[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [playerReady, setPlayerReady] = useState(isSpotifyPlayerReady())
  const [enablingPlayer, setEnablingPlayer] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!spotify.loggedIn) {
      resetBrowseState(
        setPlaylists,
        setSelectedId,
        setPreview,
        setLocalError,
        setPlayerReady,
      )
      return
    }
    prefetchSpotifySdk()
  }, [spotify.loggedIn])

  useEffect(() => {
    if (!spotify.loggedIn) return
    let cancelled = false
    setLoadingLists(true)
    setLocalError(null)
    void fetchUserPlaylists()
      .then((list) => {
        if (!cancelled) setPlaylists(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : 'Could not load playlists')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLists(false)
      })
    return () => {
      cancelled = true
    }
  }, [spotify.loggedIn])

  useEffect(() => {
    if (!selectedId) {
      setPreview([])
      return
    }
    let cancelled = false
    setLoadingTracks(true)
    setLocalError(null)
    setPreview([])
    void fetchPlaylistTracks(selectedId)
      .then((tracks) => {
        if (!cancelled) {
          setPreview(tracks)
          if (tracks.length === 0) {
            setLocalError('No playable tracks in this playlist.')
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview([])
          setLocalError(err instanceof Error ? err.message : 'Could not load tracks')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTracks(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const enablePlayer = async () => {
    setEnablingPlayer(true)
    setLocalError(null)
    try {
      await ensureSpotifyPlayer()
      setPlayerReady(true)
    } catch (err) {
      setPlayerReady(false)
      setLocalError(err instanceof Error ? err.message : 'Could not enable Spotify player')
    } finally {
      setEnablingPlayer(false)
    }
  }

  const handleLogout = () => {
    disconnectSpotifyPlayer()
    resetBrowseState(
      setPlaylists,
      setSelectedId,
      setPreview,
      setLocalError,
      setPlayerReady,
    )
    spotify.logout()
    void onLogoutCleanup?.()
  }

  const handleConnect = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (connecting || busy) return
    setConnecting(true)
    setLocalError(null)
    // Navigate in this click turn after PKCE prep — do not open track URLs
    void spotify.login().finally(() => setConnecting(false))
  }

  if (!isSpotifyConfigured()) {
    return (
      <p className="spotify-panel__hint">
        Add <code>VITE_SPOTIFY_CLIENT_ID</code> to <code>.env.local</code>
      </p>
    )
  }

  if (spotify.loading) {
    return <p className="spotify-panel__hint">Checking Spotify session…</p>
  }

  if (!spotify.loggedIn) {
    return (
      <div className="spotify-panel">
        <p className="spotify-panel__lead">
          Connect Spotify Premium to import from your playlists.
        </p>
        <button
          type="button"
          className="btn btn--spotify"
          disabled={busy || connecting}
          onClick={handleConnect}
        >
          {connecting ? 'Redirecting…' : 'Connect Spotify'}
        </button>
        {(spotify.error || localError) && (
          <p className="custom-add__error" role="alert">
            {spotify.error || localError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="spotify-panel">
      <div className="spotify-panel__user">
        {spotify.profile?.imageUrl && (
          <img
            className="spotify-panel__avatar"
            src={spotify.profile.imageUrl}
            alt=""
            width={32}
            height={32}
          />
        )}
        <div className="spotify-panel__user-meta">
          <span className="spotify-panel__name">{spotify.profile?.displayName}</span>
          <span className="spotify-panel__plan">
            {spotify.isPremium ? 'Premium' : 'Free — playback limited'}
          </span>
        </div>
        <button type="button" className="btn btn--ghost btn--xs" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <div className="spotify-panel__player-row">
        <button
          type="button"
          className="btn btn--ghost btn--xs"
          disabled={enablingPlayer || busy || !spotify.isPremium}
          onClick={() => void enablePlayer()}
        >
          {enablingPlayer
            ? 'Connecting…'
            : playerReady
              ? 'Player ready'
              : 'Enable player'}
        </button>
      </div>

      <label className="spotify-panel__label">
        Playlist
        <select
          className="custom-add__input spotify-panel__select"
          value={selectedId ?? ''}
          disabled={loadingLists || busy}
          onChange={(e) => {
            setLocalError(null)
            setSelectedId(e.target.value || null)
          }}
        >
          <option value="">{loadingLists ? 'Loading…' : 'Select playlist'}</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === LIKED_SONGS_ID
                ? 'Liked Songs'
                : `${p.owned ? '' : '~ '}${p.name}${p.trackCount >= 0 ? ` (${p.trackCount})` : ''}`}
            </option>
          ))}
        </select>
      </label>

      {loadingTracks && <p className="spotify-panel__hint">Loading tracks…</p>}

      {preview.length > 0 && (
        <>
          <ol className="spotify-panel__tracks" aria-label="Playlist tracks">
            {preview.map((t, i) => (
              <li key={`${t.uri}-${i}`} className="spotify-panel__track">
                {t.albumArt && (
                  <img
                    className="spotify-panel__cover"
                    src={t.albumArt}
                    alt=""
                    width={28}
                    height={28}
                  />
                )}
                <span className="spotify-panel__track-meta">
                  <span className="spotify-panel__track-title">{t.title}</span>
                  <span className="spotify-panel__track-artist">{t.artist}</span>
                </span>
                <span className="spotify-panel__track-time">{formatMs(t.durationMs)}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            className="btn btn--add"
            disabled={busy || loadingTracks}
            onClick={() =>
              void onImportTracks(preview)
                .then(() => setLocalError(null))
                .catch((err) => {
                  setLocalError(err instanceof Error ? err.message : 'Import failed')
                })
            }
          >
            {busy ? 'Importing…' : `Import ${preview.length} tracks`}
          </button>
        </>
      )}

      {(localError || spotify.error) && (
        <p className="custom-add__error" role="alert">
          {localError || spotify.error}
        </p>
      )}
    </div>
  )
}

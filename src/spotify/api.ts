import { SPOTIFY_API } from './config'
import { getValidAccessToken } from './auth'

export const LIKED_SONGS_ID = '__liked__'

export interface SpotifyPlaylistSummary {
  id: string
  name: string
  trackCount: number
  imageUrl?: string
  /** true = created by the logged-in user */
  owned: boolean
}

export interface SpotifyTrackSummary {
  uri: string
  title: string
  artist: string
  albumArt?: string
  durationMs: number
}

function toApiPath(nextOrPath: string): string {
  if (nextOrPath.startsWith('http')) {
    const u = new URL(nextOrPath)
    return `${u.pathname.replace(/^\/v1/, '')}${u.search}`
  }
  return nextOrPath
}

async function spotifyFetch(path: string): Promise<Response> {
  const token = await getValidAccessToken()
  if (!token) throw new Error('Not logged in to Spotify')

  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403) {
      throw new Error(
        'Spotify blocked this playlist (403). Use Liked Songs, or a playlist you own/collaborate on. Since Feb 2026, /playlists/{id}/items only allows owned playlists.',
      )
    }
    throw new Error(`Spotify API ${path} (${res.status}): ${text}`)
  }
  return res
}

async function fetchCurrentUserId(): Promise<string> {
  const res = await spotifyFetch('/me')
  const data = (await res.json()) as { id: string }
  return data.id
}

/**
 * List playlists for the current user.
 * Note (Feb 2026): track counts may come from `items.total` (new) or `tracks.total` (legacy).
 * @see https://developer.spotify.com/documentation/web-api/references/changes/february-2026
 */
export async function fetchUserPlaylists(): Promise<SpotifyPlaylistSummary[]> {
  const userId = await fetchCurrentUserId()
  const out: SpotifyPlaylistSummary[] = [
    {
      id: LIKED_SONGS_ID,
      name: 'Liked Songs',
      trackCount: -1,
      owned: true,
    },
  ]

  let path: string | null = '/me/playlists?limit=50'

  while (path) {
    const res = await spotifyFetch(path)
    const data = (await res.json()) as {
      items?: ({
        id?: string
        name?: string
        /** legacy */
        tracks?: { total?: number } | null
        /** Feb 2026 rename */
        items?: { total?: number } | null
        images?: { url: string }[] | null
        owner?: { id?: string } | null
      } | null)[]
      next?: string | null
    }

    for (const p of data.items ?? []) {
      if (!p?.id || !p.name) continue
      const trackCount = p.items?.total ?? p.tracks?.total ?? 0
      out.push({
        id: p.id,
        name: p.name,
        trackCount,
        imageUrl: p.images?.[0]?.url,
        owned: p.owner?.id === userId,
      })
    }
    path = data.next ? toApiPath(data.next) : null
  }

  out.sort((a, b) => {
    if (a.id === LIKED_SONGS_ID) return -1
    if (b.id === LIKED_SONGS_ID) return 1
    if (a.owned !== b.owned) return a.owned ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return out
}

type SpotifyTrackObject = {
  type?: string
  uri?: string | null
  name?: string
  duration_ms?: number
  artists?: { name: string }[]
  album?: { images?: { url: string }[] }
}

function mapTrack(t: SpotifyTrackObject | null | undefined): SpotifyTrackSummary | null {
  if (!t?.uri || !t.name) return null
  // Playlist items can include episodes — skip non-tracks for now
  if (t.type && t.type !== 'track') return null
  return {
    uri: t.uri,
    title: t.name,
    artist: (t.artists ?? []).map((a) => a.name).join(' · ') || 'Unknown',
    albumArt: t.album?.images?.[0]?.url,
    durationMs: t.duration_ms ?? 0,
  }
}

/** @see https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks */
export async function fetchLikedTracks(
  limit = 50,
): Promise<SpotifyTrackSummary[]> {
  const out: SpotifyTrackSummary[] = []
  let path: string | null = `/me/tracks?limit=${Math.min(50, limit)}`
  let remaining = limit

  while (path && remaining > 0) {
    const res = await spotifyFetch(path)
    const data = (await res.json()) as {
      items?: ({ track?: SpotifyTrackObject | null } | null)[]
      next?: string | null
    }

    for (const row of data.items ?? []) {
      const mapped = mapTrack(row?.track ?? undefined)
      if (mapped) {
        out.push(mapped)
        remaining -= 1
        if (remaining <= 0) break
      }
    }
    path = remaining > 0 && data.next ? toApiPath(data.next) : null
  }

  return out
}

/**
 * Get playlist contents.
 * Feb 2026: use GET /playlists/{id}/items (GET .../tracks removed).
 * Response field is `item` (not `track`).
 * @see https://developer.spotify.com/documentation/web-api/reference/get-playlists-items
 */
export async function fetchPlaylistTracks(
  playlistId: string,
): Promise<SpotifyTrackSummary[]> {
  if (playlistId === LIKED_SONGS_ID) {
    return fetchLikedTracks(100)
  }

  const out: SpotifyTrackSummary[] = []
  let path: string | null =
    `/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track`

  while (path) {
    const res = await spotifyFetch(path)
    const data = (await res.json()) as {
      items?: ({
        /** Feb 2026 */
        item?: SpotifyTrackObject | null
        /** legacy fallback */
        track?: SpotifyTrackObject | null
      } | null)[]
      next?: string | null
    }

    for (const row of data.items ?? []) {
      const mapped = mapTrack(row?.item ?? row?.track ?? undefined)
      if (mapped) out.push(mapped)
    }
    path = data.next ? toApiPath(data.next) : null
  }

  return out
}

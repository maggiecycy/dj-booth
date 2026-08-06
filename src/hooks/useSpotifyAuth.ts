import { useCallback, useEffect, useState } from 'react'
import {
  clearSpotifySession,
  cleanOAuthUrl,
  completeSpotifyOAuth,
  fetchSpotifyProfile,
  getValidAccessToken,
  isOAuthCallback,
  isSpotifyLoggedIn,
  startSpotifyLogin,
  type SpotifyProfile,
} from '../spotify/auth'
import { isSpotifyConfigured } from '../spotify/config'

export function useSpotifyAuth() {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const configured = isSpotifyConfigured()

  const refreshProfile = useCallback(async () => {
    if (!configured) {
      setProfile(null)
      setLoading(false)
      return
    }

    const token = await getValidAccessToken()
    if (!token) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      const p = await fetchSpotifyProfile(token)
      setProfile(p)
      setError(null)
    } catch (err) {
      setProfile(null)
      setError(err instanceof Error ? err.message : 'Spotify session expired')
      clearSpotifySession()
    } finally {
      setLoading(false)
    }
  }, [configured])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        if (isOAuthCallback()) {
          setLoading(true)
          await completeSpotifyOAuth()
          // URL cleaned inside completeSpotifyOAuth
        }
        if (!cancelled) {
          setError(null)
          await refreshProfile()
        }
      } catch (err) {
        if (!cancelled) {
          cleanOAuthUrl()
          setError(err instanceof Error ? err.message : 'Spotify login failed')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refreshProfile])

  const login = useCallback(async () => {
    setError(null)
    try {
      await startSpotifyLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start login')
    }
  }, [])

  const logout = useCallback(() => {
    clearSpotifySession()
    setProfile(null)
    setError(null)
  }, [])

  return {
    configured,
    loggedIn: isSpotifyLoggedIn() && Boolean(profile),
    profile,
    loading,
    error,
    login,
    logout,
    refreshProfile,
    isPremium: profile?.product === 'premium',
  }
}

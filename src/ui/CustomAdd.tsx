import { useRef, useState } from 'react'
import { SpotifyPanel } from './SpotifyPanel'

interface CustomAddProps {
  busy: boolean
  onAdd: (file: File, title: string, artist: string) => Promise<void>
  onImportSpotify: (tracks: {
    uri: string
    title: string
    artist: string
    albumArt?: string
    durationMs: number
  }[]) => Promise<void>
  onSpotifyLogoutCleanup?: () => void | Promise<void>
}

type Tab = 'local' | 'spotify'

export function CustomAdd({
  busy,
  onAdd,
  onImportSpotify,
  onSpotifyLogoutCleanup,
}: CustomAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('local')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
      setError('Pick an audio file (mp3 / wav / ogg…)')
      return
    }
    setError(null)
    try {
      await onAdd(file, title, artist)
      setTitle('')
      setArtist('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className="custom-add">
      <div className="custom-add__tabs" role="tablist" aria-label="Add tracks source">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'local'}
          className={`custom-add__tab${tab === 'local' ? ' is-active' : ''}`}
          onClick={() => setTab('local')}
        >
          Local file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'spotify'}
          className={`custom-add__tab${tab === 'spotify' ? ' is-active' : ''}`}
          onClick={() => setTab('spotify')}
        >
          Spotify
        </button>
      </div>

      {tab === 'local' ? (
        <>
          <p className="custom-add__heading">Add local track</p>
          <div className="custom-add__fields">
            <input
              className="custom-add__input"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Track title"
            />
            <input
              className="custom-add__input"
              placeholder="Artist (optional)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              aria-label="Artist"
            />
          </div>
          <div className="custom-add__actions">
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              className="custom-add__file"
              id="custom-audio-file"
              disabled={busy}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <label htmlFor="custom-audio-file" className="btn btn--add">
              {busy ? 'Decoding…' : '+ Add track'}
            </label>
          </div>
          <p className="custom-add__hint">
            Stored locally in IndexedDB · delete or reorder in track list
          </p>
        </>
      ) : (
        <SpotifyPanel
          busy={busy}
          onImportTracks={onImportSpotify}
          onLogoutCleanup={onSpotifyLogoutCleanup}
        />
      )}

      {error && (
        <p className="custom-add__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { CustomAdd } from './CustomAdd'

interface LibraryPanelProps {
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

/**
 * Separate from DJ Console — local upload + Spotify import only.
 */
export function LibraryPanel({
  busy,
  onAdd,
  onImportSpotify,
  onSpotifyLogoutCleanup,
}: LibraryPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <aside
      className={`library-panel${open ? ' is-open' : ''}`}
      aria-label="Custom library"
    >
      <button
        type="button"
        className="library-panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="library-panel__title">Library</span>
        <span className="library-panel__sub">Local · Spotify</span>
        <span className="library-panel__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="library-panel__body">
          <CustomAdd
            busy={busy}
            onAdd={onAdd}
            onImportSpotify={onImportSpotify}
            onSpotifyLogoutCleanup={onSpotifyLogoutCleanup}
          />
        </div>
      )}
    </aside>
  )
}

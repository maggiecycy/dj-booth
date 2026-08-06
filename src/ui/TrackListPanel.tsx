import type { Track } from '../audio/playlist'

interface TrackListPanelProps {
  tracks: Track[]
  currentIndex: number
  open: boolean
  onToggle: () => void
  onSelect: (index: number) => void
  editable?: boolean
  onDelete?: (trackId: string) => void
  onMove?: (fromIndex: number, toIndex: number) => void
  embedded?: boolean
}

export function TrackListPanel({
  tracks,
  currentIndex,
  open,
  onToggle,
  onSelect,
  editable,
  onDelete,
  onMove,
  embedded,
}: TrackListPanelProps) {
  if (tracks.length === 0) return null

  return (
    <div className={`track-list${open ? ' is-open' : ''}${embedded ? ' track-list--embedded' : ''}`}>
      <button
        type="button"
        className="track-list__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Track list</span>
        <span className="track-list__count">{tracks.length}</span>
        <span className="track-list__chev">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <ol className="track-list__items" aria-label="Current set tracks">
          {tracks.map((t, i) => (
            <li
              key={t.id}
              className={`track-list__item${i === currentIndex ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="track-list__play"
                aria-current={i === currentIndex ? 'true' : undefined}
                onClick={() => onSelect(i)}
              >
                <span className="track-list__idx">{i + 1}</span>
                <span className="track-list__meta">
                  <span className="track-list__title">{t.title}</span>
                  <span className="track-list__artist">{t.artist}</span>
                </span>
                {i === currentIndex && (
                  <span className="track-list__now" aria-hidden>
                    ▶
                  </span>
                )}
              </button>

              {editable && onMove && onDelete && (
                <div className="track-list__actions">
                  <button
                    type="button"
                    className="track-list__act"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => onMove(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="track-list__act"
                    aria-label="Move down"
                    disabled={i === tracks.length - 1}
                    onClick={() => onMove(i, i + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="track-list__act track-list__act--danger"
                    aria-label={`Delete ${t.title}`}
                    onClick={() => onDelete(t.id)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

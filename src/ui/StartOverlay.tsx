import { SITE } from '../config'

interface StartOverlayProps {
  loading: boolean
  error: string | null
  onStart: () => void
}

export function StartOverlay({ loading, error, onStart }: StartOverlayProps) {
  return (
    <div className="start-overlay">
      <div className="start-overlay__panel">
        <p className="start-overlay__eyebrow">click to unlock audio</p>
        <h1 className="start-overlay__brand">{SITE.name}</h1>
        <p className="start-overlay__copy">{SITE.tagline}</p>
        <button
          type="button"
          className="btn btn--start"
          onClick={onStart}
          disabled={loading}
        >
          {loading ? 'Loading decks…' : 'Enter the booth'}
        </button>
        {error && (
          <p className="start-overlay__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

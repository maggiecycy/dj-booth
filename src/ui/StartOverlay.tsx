import { SITE } from '../config'

interface StartOverlayProps {
  loading: boolean
  error: string | null
  onStart: () => void
}

export function StartOverlay({ loading, error, onStart }: StartOverlayProps) {
  return (
    <div className="start-overlay start-overlay--minimal">
      <div className="start-overlay__panel">
        <h1 className="start-overlay__brand sr-only">{SITE.name}</h1>
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

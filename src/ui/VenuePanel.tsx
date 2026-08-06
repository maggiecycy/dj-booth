import type { VenueSettings } from '../types/venue'

interface VenuePanelProps {
  settings: VenueSettings
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<VenueSettings>) => void
  embedded?: boolean
}

const SLIDERS: { key: keyof VenueSettings; label: string }[] = [
  { key: 'lights', label: 'Lights' },
  { key: 'lasers', label: 'Lasers' },
  { key: 'haze', label: 'Haze' },
  { key: 'fog', label: 'Fog' },
  { key: 'particles', label: 'Particles' },
]

export function VenuePanel({
  settings,
  open,
  onToggle,
  onChange,
  embedded,
}: VenuePanelProps) {
  return (
    <div className={`venue-panel${open ? ' is-open' : ''}${embedded ? ' venue-panel--embedded' : ''}`}>
      <button
        type="button"
        className="venue-panel__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Venue / FX</span>
        <span className="venue-panel__chev">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="venue-panel__body">
          {SLIDERS.map(({ key, label }) => (
            <label key={key} className="venue-panel__row">
              <span>{label}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings[key]}
                onChange={(e) => onChange({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

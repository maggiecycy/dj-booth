import type { VenueSettings } from '../types/venue'
import { WAVE_STYLES, type WaveStyle } from '../scene/waveVisualizer'

interface VenuePanelProps {
  settings: VenueSettings
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<VenueSettings>) => void
  embedded?: boolean
}

const SLIDERS: { key: Exclude<keyof VenueSettings, 'wave'>; label: string }[] = [
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
          <label className="venue-panel__row venue-panel__row--select">
            <span>Wave</span>
            <select
              className="venue-panel__select"
              value={settings.wave}
              aria-label="Wave visualizer style"
              onChange={(e) => onChange({ wave: e.target.value as WaveStyle })}
            >
              {WAVE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
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

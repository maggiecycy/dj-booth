import { useState, type CSSProperties } from 'react'
import type { EngineSnapshot } from '../audio/AudioEngine'
import type { Track } from '../audio/playlist'
import type { VenueSettings } from '../types/venue'
import { TrackListPanel } from './TrackListPanel'
import { VenuePanel } from './VenuePanel'

interface BoothConsoleProps {
  track: Track | null
  snapshot: EngineSnapshot
  playlist: Track[]
  currentIndex: number
  intensity: number
  venue: VenueSettings
  categoryCustom: boolean
  onIntensity: (v: number) => void
  onVenueChange: (patch: Partial<VenueSettings>) => void
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (t: number) => void
  onSelectTrack: (index: number) => void
  onDeleteCustom?: (id: string) => void
  onMoveCustom?: (from: number, to: number) => void
  onShoutMood?: (text: string) => void
  onAudioWarmUp?: () => void
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function BoothConsole({
  track,
  snapshot,
  playlist,
  currentIndex,
  intensity,
  venue,
  categoryCustom,
  onIntensity,
  onVenueChange,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onSelectTrack,
  onDeleteCustom,
  onMoveCustom,
  onShoutMood,
  onAudioWarmUp,
}: BoothConsoleProps) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [trackListOpen, setTrackListOpen] = useState(true)
  const [venueOpen, setVenueOpen] = useState(false)
  const [moodText, setMoodText] = useState('')

  const playing = snapshot.loadState === 'playing'
  const progress =
    snapshot.duration > 0 ? snapshot.currentTime / snapshot.duration : 0

  return (
    <div
      className={`booth-console${playerOpen ? ' is-player-open' : ' is-mini'}${expanded ? ' is-expanded' : ''}`}
      id="booth-console"
      aria-label="DJ booth console"
    >
      {playerOpen && <div className="booth-console__bridge" aria-hidden />}

      <div className="booth-console__deck">
        {playerOpen && (
          <header className="booth-console__header">
            <span className="booth-console__title-label">DJ Console</span>
            <div className="booth-console__header-actions">
              <button
                type="button"
                className="booth-console__toggle"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse panels' : 'Expand panels'}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '▾' : '▸'}
              </button>
              <button
                type="button"
                className="booth-console__toggle booth-console__toggle--mini"
                aria-label="Hide player"
                onClick={() => {
                  setPlayerOpen(false)
                  setExpanded(false)
                }}
              >
                ▾
              </button>
            </div>
          </header>
        )}

        {playerOpen && track && (
          <>
            <div className="booth-console__transport-row">
              <button type="button" className="btn btn--ghost btn--xs" aria-label="Previous" onClick={onPrev}>
                <PrevIcon />
              </button>
              <button
                type="button"
                className="btn btn--mini-play"
                aria-label={playing ? 'Pause' : 'Play'}
                onPointerDown={() => onAudioWarmUp?.()}
                onClick={onPlayPause}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button type="button" className="btn btn--ghost btn--xs" aria-label="Next" onClick={onNext}>
                <NextIcon />
              </button>
              <div className="booth-console__now">
                <span className="booth-console__track">{track.title}</span>
                <span className="booth-console__time">
                  {formatTime(snapshot.currentTime)} / {formatTime(snapshot.duration)}
                </span>
              </div>
            </div>

            <input
              className="slider slider--thin booth-console__seek"
              type="range"
              min={0}
              max={snapshot.duration || 1}
              step={0.01}
              value={snapshot.currentTime}
              aria-label="Seek"
              onChange={(e) => onSeek(Number(e.target.value))}
              style={{ '--progress': `${progress * 100}%` } as CSSProperties}
            />
          </>
        )}

        {onShoutMood && (
          <form
            className="booth-console__shout"
            onSubmit={(e) => {
              e.preventDefault()
              if (!moodText.trim()) return
              onShoutMood(moodText)
              setMoodText('')
            }}
          >
            <input
              type="text"
              className="booth-console__shout-input"
              placeholder="Send a vibe to the crowd…"
              maxLength={48}
              value={moodText}
              aria-label="Send mood to crowd"
              onChange={(e) => setMoodText(e.target.value)}
            />
            <button type="submit" className="btn btn--ghost btn--xs booth-console__shout-btn" aria-label="Send">
              ↑
            </button>
            {!playerOpen && (
              <button
                type="button"
                className="btn btn--ghost btn--xs booth-console__music-toggle"
                aria-label="Show music controls"
                onClick={() => setPlayerOpen(true)}
              >
                ♫
              </button>
            )}
          </form>
        )}

        {playerOpen && expanded && track && (
          <div className="booth-console__panels">
            <div className="booth-console__section">
              <p className="booth-console__section-label">Now playing</p>
              <p className="now-playing__artist">{track.artist}</p>
              <div className="tags">
                <span className="tag tag--cat">{track.category}</span>
                {track.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <label className="intensity booth-console__motion">
                <span>Motion</span>
                <input
                  type="range"
                  min={0.2}
                  max={1.4}
                  step={0.05}
                  value={intensity}
                  onChange={(e) => onIntensity(Number(e.target.value))}
                />
              </label>
            </div>

            <TrackListPanel
              embedded
              tracks={playlist}
              currentIndex={currentIndex}
              open={trackListOpen}
              onToggle={() => setTrackListOpen((v) => !v)}
              onSelect={onSelectTrack}
              editable={categoryCustom}
              onDelete={onDeleteCustom}
              onMove={onMoveCustom}
            />

            <VenuePanel
              embedded
              settings={venue}
              open={venueOpen}
              onToggle={() => setVenueOpen((v) => !v)}
              onChange={onVenueChange}
            />
          </div>
        )}

        {playerOpen && expanded && !track && categoryCustom && (
          <div className="booth-console__panels">
            <VenuePanel
              embedded
              settings={venue}
              open={venueOpen}
              onToggle={() => setVenueOpen((v) => !v)}
              onChange={onVenueChange}
            />
          </div>
        )}

        {playerOpen && snapshot.error && (
          <p className="booth-console__error" role="alert">
            {snapshot.error}
          </p>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
    </svg>
  )
}

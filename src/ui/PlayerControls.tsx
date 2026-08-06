import type { CSSProperties } from 'react'
import type { EngineSnapshot } from '../audio/AudioEngine'
import type { Track } from '../audio/playlist'

interface PlayerControlsProps {
  track: Track
  snapshot: EngineSnapshot
  intensity: number
  onIntensity: (v: number) => void
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (t: number) => void
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerControls({
  track,
  snapshot,
  intensity,
  onIntensity,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}: PlayerControlsProps) {
  const playing = snapshot.loadState === 'playing'
  const progress =
    snapshot.duration > 0 ? snapshot.currentTime / snapshot.duration : 0

  return (
    <div className="controls">
      <div className="controls__transport">
        <button
          type="button"
          className="btn btn--ghost"
          aria-label="Previous track"
          onClick={onPrev}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className="btn btn--play"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={onPlayPause}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          aria-label="Next track"
          onClick={onNext}
        >
          <NextIcon />
        </button>
      </div>

      <div className="controls__progress">
        <span className="controls__time">
          {formatTime(snapshot.currentTime)}
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={snapshot.duration || 1}
          step={0.01}
          value={snapshot.currentTime}
          aria-label="Seek"
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ '--progress': `${progress * 100}%` } as CSSProperties}
        />
        <span className="controls__time">
          {formatTime(snapshot.duration)}
        </span>
      </div>

      <div className="controls__meta" aria-live="polite">
        <div className="now-playing">
          <p className="now-playing__label">Now playing</p>
          <p className="now-playing__title">{track.title}</p>
          <p className="now-playing__artist">{track.artist}</p>
          <div className="tags">
            <span className="tag tag--cat">{track.category}</span>
            {track.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <label className="intensity">
          <span>Motion</span>
          <input
            type="range"
            min={0.2}
            max={1.4}
            step={0.05}
            value={intensity}
            onChange={(e) => onIntensity(Number(e.target.value))}
            aria-label="Motion intensity"
          />
        </label>
      </div>

      {snapshot.error && (
        <p className="controls__error" role="alert">
          {snapshot.error}
        </p>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
    </svg>
  )
}

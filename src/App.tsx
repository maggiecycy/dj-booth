import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapBandsToMotion } from './audio/analysis'
import {
  addCustomTrackFromFile,
  loadCustomTracks,
  removeCustomTrack,
} from './audio/customStore'
import {
  CATEGORIES,
  getTracksForCategory,
  type CategoryId,
  type Track,
} from './audio/playlist'
import { MOTION, SITE } from './config'
import { useAudioEngine, usePrefersReducedMotion } from './hooks/useAudioEngine'
import { DJScene } from './scene/DJScene'
import { PerformanceLoop } from './scene/PerformanceLoop'
import { CategoryBar } from './ui/CategoryBar'
import { CustomAdd } from './ui/CustomAdd'
import { PlayerControls } from './ui/PlayerControls'
import { StartOverlay } from './ui/StartOverlay'

export function App() {
  const { engine, snapshot } = useAudioEngine()
  const prefersReduced = usePrefersReducedMotion()
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [intensity, setIntensity] = useState<number>(MOTION.defaultIntensity)
  const [, setClock] = useState(0)
  const [category, setCategory] = useState<CategoryId>('mix')
  const [customTracks, setCustomTracks] = useState<Track[]>([])
  const [playlist, setPlaylist] = useState<Track[]>(() =>
    getTracksForCategory('mix'),
  )
  const [adding, setAdding] = useState(false)
  const [customReady, setCustomReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transitionRef = useRef(0)
  const intensityRef = useRef(intensity)
  const reducedRef = useRef(prefersReduced)
  const trackIndexRef = useRef(snapshot.trackIndex)
  const playlistRef = useRef(playlist)

  intensityRef.current = intensity
  reducedRef.current = prefersReduced
  trackIndexRef.current = snapshot.trackIndex
  playlistRef.current = playlist

  const track = playlist[snapshot.trackIndex] ?? null

  const counts = useMemo(() => {
    const result: Partial<Record<CategoryId, number>> = {}
    for (const cat of CATEGORIES) {
      result[cat.id] = getTracksForCategory(cat.id, customTracks).length
    }
    return result
  }, [customTracks])

  // Restore custom tracks from IndexedDB once
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const tracks = await loadCustomTracks()
        if (!cancelled) {
          setCustomTracks(tracks)
          setCustomReady(true)
        }
      } catch {
        if (!cancelled) setCustomReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (snapshot.loadState !== 'playing') return
    const id = window.setInterval(() => setClock((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [snapshot.loadState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new DJScene(canvas)
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      scene.resize(parent.clientWidth, parent.clientHeight)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const loop = new PerformanceLoop((dt) => {
      const bands = engine.sampleBands(dt)
      const playing = engine.isPlaying()
      const intensityNow = reducedRef.current
        ? Math.min(intensityRef.current, MOTION.reducedIntensity)
        : intensityRef.current
      const motion = mapBandsToMotion(
        bands,
        playing,
        intensityNow,
        engine.getBeatFlash(),
      )
      transitionRef.current = Math.max(0, transitionRef.current - dt * 1.6)
      const list = playlistRef.current
      const currentTrack = list[trackIndexRef.current] ?? null
      const frame = {
        motion,
        track: currentTrack,
        playing,
        transition: transitionRef.current,
        reducedMotion: reducedRef.current,
      }
      scene.update(dt, frame)
      scene.draw(frame)
    })
    loop.start()

    return () => {
      loop.stop()
      ro.disconnect()
    }
  }, [engine])

  const applyCategory = useCallback(
    async (id: CategoryId, customs = customTracks, autoplay = started) => {
      const next = getTracksForCategory(id, customs)
      setCategory(id)
      setPlaylist(next)
      transitionRef.current = 1
      await engine.setPlaylist(next, autoplay && next.length > 0)
    },
    [customTracks, engine, started],
  )

  const handleStart = async () => {
    setStarting(true)
    try {
      await engine.unlock()
      const initial = getTracksForCategory(category, customTracks)
      setPlaylist(initial)
      await engine.setPlaylist(initial, true)
      void engine.preloadAll()
      setStarted(true)
    } catch {
      /* surfaced via snapshot.error */
    } finally {
      setStarting(false)
    }
  }

  const handleAddCustom = async (
    file: File,
    title: string,
    artist: string,
  ) => {
    setAdding(true)
    try {
      const trackNew = await addCustomTrackFromFile(file, {
        title: title || undefined,
        artist: artist || undefined,
      })
      const nextCustoms = [...customTracks, trackNew]
      setCustomTracks(nextCustoms)
      const nextList = getTracksForCategory('custom', nextCustoms)
      setCategory('custom')
      setPlaylist(nextList)
      transitionRef.current = 1
      await engine.setPlaylist(nextList, true)
      // Jump to the newly added track
      await engine.select(nextList.length - 1, true)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveCurrent = async () => {
    if (!track?.custom) return
    const id = track.id
    if (track.src.startsWith('blob:')) URL.revokeObjectURL(track.src)
    await removeCustomTrack(id)
    const nextCustoms = customTracks.filter((t) => t.id !== id)
    setCustomTracks(nextCustoms)
    const nextList = getTracksForCategory('custom', nextCustoms)
    setPlaylist(nextList)
    await engine.setPlaylist(nextList, nextList.length > 0 && started)
  }

  const triggerTransition = () => {
    transitionRef.current = 1
  }

  return (
    <div className="app">
      <a className="skip-link" href="#controls">
        Skip to controls
      </a>

      <main className="stage">
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          aria-label={`${SITE.name} DJ stage`}
        />

        {!started && (
          <StartOverlay
            loading={starting || snapshot.loadState === 'loading'}
            error={snapshot.error}
            onStart={() => void handleStart()}
          />
        )}

        {started && (
          <div className="stage__ui" id="controls">
            <CategoryBar
              categories={CATEGORIES}
              active={category}
              counts={counts}
              onSelect={(id) => void applyCategory(id)}
            />

            {category === 'custom' && customReady && (
              <CustomAdd
                busy={adding}
                onAdd={handleAddCustom}
                hasCurrentCustom={Boolean(track?.custom)}
                onRemoveCurrent={() => void handleRemoveCurrent()}
              />
            )}

            {playlist.length === 0 ? (
              <div className="controls controls--empty">
                <p className="empty-set">
                  这个专场还是空的。切到「自定义」添加本地音频，或换一个分类。
                </p>
              </div>
            ) : (
              track && (
                <PlayerControls
                  track={track}
                  snapshot={{
                    ...snapshot,
                    currentTime: engine.getCurrentTime(),
                  }}
                  intensity={intensity}
                  onIntensity={setIntensity}
                  onPlayPause={() => engine.toggle()}
                  onPrev={() => {
                    triggerTransition()
                    void engine.prev(true)
                  }}
                  onNext={() => {
                    triggerTransition()
                    void engine.next(true)
                  }}
                  onSeek={(t) => void engine.seek(t)}
                />
              )
            )}

            {prefersReduced && (
              <p className="a11y-note">
                Reduced motion is on — intensity capped.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapBandsToMotion } from './audio/analysis'
import {
  addCustomTrackFromFile,
  loadCustomTracks,
  removeCustomTrack,
  reorderCustomTracks,
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
import type { StageFxEvent } from './scene/stageFx'
import { DEFAULT_VENUE, type VenueSettings } from './types/venue'
import { BoothConsole } from './ui/BoothConsole'
import { CategoryBar } from './ui/CategoryBar'
import { StartOverlay } from './ui/StartOverlay'

export function App() {
  const { engine, snapshot } = useAudioEngine()
  const prefersReduced = usePrefersReducedMotion()
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [intensity, setIntensity] = useState<number>(MOTION.defaultIntensity)
  const [, setClock] = useState(0)
  const [category, setCategory] = useState<CategoryId>('fredagain')
  const [customTracks, setCustomTracks] = useState<Track[]>([])
  const [playlist, setPlaylist] = useState<Track[]>(() =>
    getTracksForCategory('fredagain'),
  )
  const [adding, setAdding] = useState(false)
  const [customReady, setCustomReady] = useState(false)
  const [venue, setVenue] = useState<VenueSettings>(DEFAULT_VENUE)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<DJScene | null>(null)
  const fxQueue = useRef<StageFxEvent[]>([])
  const moodQueue = useRef<string[]>([])
  const tapTimesRef = useRef<number[]>([])
  const pointerRef = useRef({
    active: false,
    dragging: false,
    longPress: false,
    startX: 0,
    startY: 0,
    pointerId: -1,
    timer: 0 as ReturnType<typeof setTimeout> | 0,
  })
  const lastDragAt = useRef(0)
  const transitionRef = useRef(0)
  const intensityRef = useRef(intensity)
  const reducedRef = useRef(prefersReduced)
  const trackIndexRef = useRef(snapshot.trackIndex)
  const playlistRef = useRef(playlist)
  const categoryRef = useRef(category)
  const venueRef = useRef(venue)

  intensityRef.current = intensity
  reducedRef.current = prefersReduced
  trackIndexRef.current = snapshot.trackIndex
  playlistRef.current = playlist
  categoryRef.current = category
  venueRef.current = venue

  const track = playlist[snapshot.trackIndex] ?? null

  const counts = useMemo(() => {
    const result: Partial<Record<CategoryId, number>> = {}
    for (const cat of CATEGORIES) {
      result[cat.id] = getTracksForCategory(cat.id, customTracks).length
    }
    return result
  }, [customTracks])

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
    sceneRef.current = scene
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      scene.resize(parent.clientWidth, parent.clientHeight)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const loop = new PerformanceLoop((dt) => {
      for (const ev of fxQueue.current) {
        const pAmt = venueRef.current.particles
        if (ev.type === 'tap') {
          scene.triggerCheer(ev.x, ev.y, pAmt)
        } else if (ev.type === 'drag') {
          scene.triggerDragTrail(ev.x, ev.y, pAmt)
        } else {
          scene.triggerMegaBurst(ev.x, ev.y, pAmt)
          transitionRef.current = 1
        }
      }
      fxQueue.current = []

      for (const text of moodQueue.current) {
        scene.triggerMood(text)
      }
      moodQueue.current = []

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
        boothCategory: categoryRef.current,
        venue: venueRef.current,
      }
      scene.update(dt, frame)
      scene.draw(frame)
    })
    loop.start()

    return () => {
      loop.stop()
      ro.disconnect()
      sceneRef.current = null
    }
  }, [engine])

  const canvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const handleShoutMood = (text: string) => {
    if (!started || !text.trim()) return
    moodQueue.current.push(text)
  }

  const handleStagePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!started || e.button !== 0) return
    const pt = canvasPoint(e.clientX, e.clientY)
    if (!pt) return

    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointerRef.current
    p.active = true
    p.dragging = false
    p.longPress = false
    p.startX = pt.x
    p.startY = pt.y
    p.pointerId = e.pointerId
    if (p.timer) clearTimeout(p.timer)
    p.timer = setTimeout(() => {
      if (!p.active) return
      p.longPress = true
      fxQueue.current.push({ type: 'drag', x: pt.x, y: pt.y })
    }, 280)
  }

  const handleStagePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerRef.current
    if (!p.active || p.pointerId !== e.pointerId) return
    const pt = canvasPoint(e.clientX, e.clientY)
    if (!pt) return

    const dist = Math.hypot(pt.x - p.startX, pt.y - p.startY)
    if (dist > 10) {
      p.dragging = true
      if (p.timer) {
        clearTimeout(p.timer)
        p.timer = 0
      }
    }

    if (p.dragging || p.longPress) {
      const now = performance.now()
      if (now - lastDragAt.current > 32) {
        lastDragAt.current = now
        fxQueue.current.push({ type: 'drag', x: pt.x, y: pt.y })
      }
    }
  }

  const finishStagePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerRef.current
    if (!p.active || p.pointerId !== e.pointerId) return

    const pt = canvasPoint(e.clientX, e.clientY)
    if (p.timer) {
      clearTimeout(p.timer)
      p.timer = 0
    }

    if (pt && !p.dragging && !p.longPress) {
      const now = Date.now()
      tapTimesRef.current = tapTimesRef.current.filter((t) => now - t < 900)
      tapTimesRef.current.push(now)
      if (tapTimesRef.current.length > 3) {
        fxQueue.current.push({ type: 'mega', x: pt.x, y: pt.y })
        tapTimesRef.current = []
        transitionRef.current = 1
      } else {
        fxQueue.current.push({ type: 'tap', x: pt.x, y: pt.y })
        transitionRef.current = 0.6
      }
    }

    p.active = false
    p.dragging = false
    p.longPress = false
    p.pointerId = -1
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

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
      await engine.select(nextList.length - 1, true)
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteCustom = async (trackId: string) => {
    const victim = customTracks.find((t) => t.id === trackId)
    if (!victim) return
    if (victim.src.startsWith('blob:')) URL.revokeObjectURL(victim.src)
    await removeCustomTrack(trackId)
    const nextCustoms = customTracks.filter((t) => t.id !== trackId)
    setCustomTracks(nextCustoms)
    const nextList = getTracksForCategory('custom', nextCustoms)
    setPlaylist(nextList)
    await engine.setPlaylist(nextList, nextList.length > 0 && started)
  }

  const handleMoveCustom = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...customTracks]
    const [item] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, item)
    reorderCustomTracks(next.map((t) => t.id))
    setCustomTracks(next)
    const nextList = getTracksForCategory('custom', next)
    const currentId = playlist[snapshot.trackIndex]?.id
    setPlaylist(nextList)
    const newIdx = currentId ? nextList.findIndex((t) => t.id === currentId) : 0
    if (started && nextList.length > 0) {
      await engine.setPlaylist(nextList, engine.isPlaying())
      if (newIdx >= 0) await engine.select(newIdx, engine.isPlaying())
    }
  }

  const handleSelectTrack = async (index: number) => {
    if (index === snapshot.trackIndex) {
      engine.toggle()
      return
    }
    transitionRef.current = 1
    await engine.select(index, true)
  }

  const triggerTransition = () => {
    transitionRef.current = 1
  }

  return (
    <div className="app">
      <a className="skip-link" href="#booth-console">
        Skip to controls
      </a>

      <main className="stage">
        <canvas
          ref={canvasRef}
          className="stage__canvas"
          aria-label={`${SITE.name} DJ stage`}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={finishStagePointer}
          onPointerCancel={finishStagePointer}
        />

        {!started && (
          <StartOverlay
            loading={starting || snapshot.loadState === 'loading'}
            error={snapshot.error}
            onStart={() => void handleStart()}
          />
        )}

        {started && (
          <>
            <div className="stage__top-ui">
              <CategoryBar
                categories={CATEGORIES}
                active={category}
                counts={counts}
                onSelect={(id) => void applyCategory(id)}
              />

              {playlist.length === 0 && category !== 'custom' && (
                <div className="controls controls--empty">
                  <p className="empty-set">
                    This set is empty — switch to Custom to add tracks, or pick another category.
                  </p>
                </div>
              )}

              {category === 'custom' && playlist.length === 0 && (
                <div className="controls controls--empty">
                  <p className="empty-set">Custom set is empty — add tracks below.</p>
                </div>
              )}

              {prefersReduced && (
                <p className="a11y-note">Reduced motion — intensity capped</p>
              )}
            </div>

            {started && (
              <BoothConsole
                track={track}
                snapshot={{
                  ...snapshot,
                  currentTime: engine.getCurrentTime(),
                }}
                playlist={playlist}
                currentIndex={snapshot.trackIndex}
                intensity={intensity}
                venue={venue}
                categoryCustom={category === 'custom'}
                customReady={customReady}
                adding={adding}
                onIntensity={setIntensity}
                onVenueChange={(patch) => setVenue((v) => ({ ...v, ...patch }))}
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
                onSelectTrack={(i) => void handleSelectTrack(i)}
                onDeleteCustom={(id) => void handleDeleteCustom(id)}
                onMoveCustom={(from, to) => void handleMoveCustom(from, to)}
                onAddCustom={handleAddCustom}
                onShoutMood={handleShoutMood}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App

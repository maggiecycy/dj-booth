import { useRef, useSyncExternalStore } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { PLAYLIST } from '../audio/playlist'

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new AudioEngine(PLAYLIST)
  }
  const engine = engineRef.current

  const snapshot = useSyncExternalStore(
    (onStoreChange) => engine.subscribe(onStoreChange),
    () => engine.snapshot(),
    () => engine.snapshot(),
  )

  return { engine, snapshot }
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

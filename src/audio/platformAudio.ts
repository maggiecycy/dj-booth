/** iOS / iPadOS — BufferSource often runs silently; HTMLAudioElement is reliable. */
export function prefersMediaElementPlayback(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios
}

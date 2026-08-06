import type { Track, TrackMood } from './playlist'

const META_KEY = 'night-booth-custom-meta-v1'
const DB_NAME = 'night-booth'
const STORE = 'custom-audio'

export interface CustomTrackMeta {
  id: string
  title: string
  artist: string
  mood: TrackMood
  tags: string[]
  bpmHint: number
  /** MIME from upload, for decode hints */
  mime?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function idbGet(key: string): Promise<ArrayBuffer | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbPut(key: string, value: ArrayBuffer): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function loadCustomMeta(): CustomTrackMeta[] {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomTrackMeta[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomMeta(list: CustomTrackMeta[]): void {
  localStorage.setItem(META_KEY, JSON.stringify(list))
}

export async function loadCustomTracks(): Promise<Track[]> {
  const meta = loadCustomMeta()
  const tracks: Track[] = []
  for (const m of meta) {
    const buf = await idbGet(m.id)
    if (!buf) continue
    const blob = new Blob([buf], { type: m.mime || 'audio/*' })
    const src = URL.createObjectURL(blob)
    tracks.push(metaToTrack(m, src))
  }
  return tracks
}

export async function addCustomTrackFromFile(
  file: File,
  overrides?: Partial<Pick<CustomTrackMeta, 'title' | 'artist' | 'bpmHint'>>,
): Promise<Track> {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const raw = await file.arrayBuffer()
  await idbPut(id, raw.slice(0))

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const meta: CustomTrackMeta = {
    id,
    title: overrides?.title?.trim() || baseName || 'Untitled',
    artist: overrides?.artist?.trim() || 'Custom',
    mood: 'amber',
    tags: ['custom'],
    bpmHint: overrides?.bpmHint ?? 120,
    mime: file.type || 'audio/*',
  }

  const list = loadCustomMeta()
  list.push(meta)
  saveCustomMeta(list)

  const src = URL.createObjectURL(new Blob([raw], { type: meta.mime }))
  return metaToTrack(meta, src)
}

export async function removeCustomTrack(id: string): Promise<void> {
  const list = loadCustomMeta().filter((m) => m.id !== id)
  saveCustomMeta(list)
  await idbDelete(id)
}

/** Persist a new order for custom tracks (by id). */
export function reorderCustomTracks(orderedIds: string[]): void {
  const meta = loadCustomMeta()
  const byId = new Map(meta.map((m) => [m.id, m]))
  const next: CustomTrackMeta[] = []
  for (const id of orderedIds) {
    const m = byId.get(id)
    if (m) next.push(m)
  }
  for (const m of meta) {
    if (!orderedIds.includes(m.id)) next.push(m)
  }
  saveCustomMeta(next)
}

function metaToTrack(m: CustomTrackMeta, src: string): Track {
  return {
    id: m.id,
    title: m.title,
    artist: m.artist,
    mood: m.mood,
    category: 'custom',
    tags: m.tags,
    src,
    bpmHint: m.bpmHint,
    custom: true,
  }
}

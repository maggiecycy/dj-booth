export type TrackMood = 'warm' | 'cool' | 'amber' | 'deep' | 'bright' | 'mist'

/** EDM booth sets + mix + user custom */
export type CategoryId =
  | 'house'
  | 'techno'
  | 'melodic'
  | 'deep'
  | 'trance'
  | 'dnb'
  | 'mix'
  | 'custom'

export interface Category {
  id: CategoryId
  label: string
  blurb: string
}

export interface Track {
  id: string
  title: string
  artist: string
  mood: TrackMood
  category: Exclude<CategoryId, 'mix' | 'custom'> | 'custom'
  tags: string[]
  /** Path under public/ — spaces encoded for fetch */
  src: string
  bpmHint: number
  custom?: boolean
}

export const CATEGORIES: Category[] = [
  { id: 'house', label: 'House', blurb: '4/4 groove · warm floor' },
  { id: 'techno', label: 'Techno', blurb: 'machine pulse · warehouse' },
  { id: 'melodic', label: 'Melodic', blurb: 'emotional · rolling bass' },
  { id: 'deep', label: 'Deep House', blurb: 'late night · soft grid' },
  { id: 'trance', label: 'Trance', blurb: 'lift · long build' },
  { id: 'dnb', label: 'DnB', blurb: 'breaks · forward rush' },
  { id: 'mix', label: '混搭', blurb: 'public/music · 全部' },
  { id: 'custom', label: '自定义', blurb: '浏览器里临时添加' },
]

/** Build URL-safe path for files in public/music/ */
export function musicSrc(filename: string): string {
  return `/music/${encodeURIComponent(filename)}`
}

/**
 * 曲库：直接读 public/music/ 里的文件。
 * 新增 mp3 → 在此补一条；改歌名/专场也在这里。
 */
export const CATALOG: Track[] = [
  {
    id: 'file-1',
    title: 'File 1',
    artist: 'Local',
    mood: 'warm',
    category: 'house',
    tags: ['house'],
    src: musicSrc('File 1.mp3'),
    bpmHint: 122,
  },
  {
    id: 'file-2',
    title: 'File 2',
    artist: 'Local',
    mood: 'cool',
    category: 'techno',
    tags: ['techno'],
    src: musicSrc('File 2.mp3'),
    bpmHint: 128,
  },
  {
    id: 'file-3',
    title: 'File 3',
    artist: 'Local',
    mood: 'amber',
    category: 'melodic',
    tags: ['melodic'],
    src: musicSrc('File 3.mp3'),
    bpmHint: 124,
  },
  {
    id: 'file-4',
    title: 'File 4',
    artist: 'Local',
    mood: 'deep',
    category: 'deep',
    tags: ['deep house'],
    src: musicSrc('File 4.mp3'),
    bpmHint: 118,
  },
  {
    id: 'file-5',
    title: 'File 5',
    artist: 'Local',
    mood: 'bright',
    category: 'trance',
    tags: ['trance'],
    src: musicSrc('File 5.mp3'),
    bpmHint: 132,
  },
  {
    id: 'file-6',
    title: 'File 6',
    artist: 'Local',
    mood: 'deep',
    category: 'dnb',
    tags: ['dnb'],
    src: musicSrc(
      'obj_wo3DlMOGwrbDjj7DisKw_57801254084_51ac_5f6e_8d6e_f96b0dc89c53fe5b8742aac21eb6588a.mp3',
    ),
    bpmHint: 174,
  },
]

export const PLAYLIST: Track[] = CATALOG

export function getTracksForCategory(
  categoryId: CategoryId,
  customTracks: Track[] = [],
): Track[] {
  if (categoryId === 'custom') return customTracks
  if (categoryId === 'mix') return CATALOG
  return CATALOG.filter((t) => t.category === categoryId)
}

export function categoryById(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

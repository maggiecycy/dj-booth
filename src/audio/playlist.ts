export type TrackMood = 'warm' | 'cool' | 'amber' | 'deep' | 'bright' | 'mist'

export type CategoryId =
  | 'house'
  | 'techno'
  | 'melodic'
  | 'deep'
  | 'trance'
  | 'dnb'
  | 'fredagain'
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
  src: string
  bpmHint: number
  custom?: boolean
}

export const CATEGORIES: Category[] = [
  { id: 'fredagain', label: 'Fred again..', blurb: 'emotional · headphone · live edits' },
  { id: 'house', label: 'House', blurb: '4/4 groove · warm floor' },
  { id: 'techno', label: 'Techno', blurb: 'machine pulse · warehouse' },
  { id: 'melodic', label: 'Melodic', blurb: 'emotional · rolling bass' },
  { id: 'deep', label: 'Deep House', blurb: 'late night · soft grid' },
  { id: 'trance', label: 'Trance', blurb: 'lift · long build' },
  { id: 'dnb', label: 'DnB', blurb: 'breaks · forward rush' },
  { id: 'mix', label: '混搭', blurb: 'public/music · 全部' },
  { id: 'custom', label: '自定义', blurb: '浏览器里临时添加' },
]

export function musicSrc(filename: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}music/${encodeURIComponent(filename)}`
}

function t(
  id: string,
  file: string,
  title: string,
  artist: string,
  mood: TrackMood,
  category: Track['category'],
  tags: string[],
  bpmHint: number,
): Track {
  return { id, title, artist, mood, category, tags, src: musicSrc(file), bpmHint }
}

/** public/music/ 曲库 */
export const CATALOG: Track[] = [
  // Fred again..
  t('did-it-again', 'DID IT AGAIN - Travy,Fred again..,elzzz.mp3', 'DID IT AGAIN', 'Travy · Fred again.. · elzzz', 'amber', 'fredagain', ['fred again', 'emotional'], 124),
  t('delilah', 'Delilah (pull me out of this) - Fred again..,Delilah Montagu.mp3', 'Delilah (pull me out of this)', 'Fred again.. · Delilah Montagu', 'amber', 'fredagain', ['fred again', 'delilah'], 122),
  t('halo', 'Halo - Fred again..,LATIN MAFIA,Lil Yachty.mp3', 'Halo', 'Fred again.. · LATIN MAFIA · Lil Yachty', 'warm', 'fredagain', ['fred again', 'halo'], 120),
  t('quiereme', 'Quiereme - LATIN MAFIA,Fred again..mp3', 'Quiereme', 'LATIN MAFIA · Fred again..', 'warm', 'fredagain', ['fred again', 'latin'], 123),
  t('benjy-chord', 'benjy chord - Fred again..,LATIN MAFIA.mp3', 'benjy chord', 'Fred again.. · LATIN MAFIA', 'deep', 'fredagain', ['fred again', 'chord'], 118),
  t('just-stand-there', 'just stand there : One More Time (Mixed).mp3', 'just stand there : One More Time', 'Fred again.. (edit)', 'amber', 'fredagain', ['fred again', 'mixed'], 126),

  // House / club
  t('no-broke-boys-mix', 'No Broke Boys x Make Me Feel Like - Emilie Charlotte.mp3', 'No Broke Boys × Make Me Feel Like', 'Emilie Charlotte', 'warm', 'house', ['house', 'mashup'], 124),
  t('make-me-feel', ' Make Me Feel Like.mp3', 'Make Me Feel Like', 'Local', 'warm', 'house', ['house'], 122),
  t('rizz-ayybo', 'RIZZ-AYYBO.mp3', 'RIZZ', 'AYYBO', 'bright', 'house', ['house', 'tech house'], 128),

  // Techno
  t('no-broke-boys-techno', 'NO BROKE BOYS (TECHNO) - Sayo Hayes,Strobe.mp3', 'NO BROKE BOYS (TECHNO)', 'Sayo Hayes · Strobe', 'cool', 'techno', ['techno'], 130),

  // Deep
  t('no-broke-boys-deep', 'No Broke Boys（Deep House） .mp3', 'No Broke Boys (Deep House)', 'Local', 'deep', 'deep', ['deep house'], 118),

  // DnB
  t('starboy-nia', 'Starboy (feat. Daft Punk) : leavemealone : leavemealone (Nia Archives Remix) .mp3', 'Starboy (Nia Archives Remix)', 'The Weeknd · Nia Archives', 'bright', 'dnb', ['dnb', 'remix'], 174),
]

export const PLAYLIST: Track[] = CATALOG

export function getTracksForCategory(
  categoryId: CategoryId,
  customTracks: Track[] = [],
): Track[] {
  if (categoryId === 'custom') return customTracks
  if (categoryId === 'mix') return CATALOG
  return CATALOG.filter((track) => track.category === categoryId)
}

export function categoryById(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

/** Scene pose key: active booth category, or track category when on mix */
export function sceneDanceStyle(
  boothCategory: CategoryId,
  track: Track | null,
): CategoryId {
  if (boothCategory !== 'mix' && boothCategory !== 'custom') return boothCategory
  if (track && track.category !== 'custom') return track.category
  return 'house'
}

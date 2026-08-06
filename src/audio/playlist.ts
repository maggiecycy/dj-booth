import { MUSIC } from '../config'

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
  { id: 'mix', label: 'Mix', blurb: 'all tracks · public/music' },
  { id: 'custom', label: 'Custom', blurb: 'add local files in browser' },
]

export function musicSrc(filename: string): string {
  if (/^(https?:|blob:)/.test(filename)) return filename
  if (MUSIC.cdnBase) {
    return `${MUSIC.cdnBase}/${encodeURIComponent(filename)}`
  }
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

/** Synced with files in public/music/ */
export const CATALOG: Track[] = [
  // ── Fred again.. (6) ───────────────────────────────────────────────
  t('did-it-again', 'DID IT AGAIN - Travy,Fred again..,elzzz.mp3', 'DID IT AGAIN', 'Travy · Fred again.. · elzzz', 'amber', 'fredagain', ['fred again'], 124),
  t('delilah', 'Delilah (pull me out of this) - Fred again..,Delilah Montagu.mp3', 'Delilah (pull me out of this)', 'Fred again.. · Delilah Montagu', 'amber', 'fredagain', ['fred again'], 122),
  t('halo', 'Halo - Fred again..,LATIN MAFIA,Lil Yachty.mp3', 'Halo', 'Fred again.. · LATIN MAFIA · Lil Yachty', 'warm', 'fredagain', ['fred again'], 120),
  t('quiereme', 'Quiereme - LATIN MAFIA,Fred again..mp3', 'Quiereme', 'LATIN MAFIA · Fred again..', 'warm', 'fredagain', ['fred again'], 123),
  t('benjy-chord', 'benjy chord - Fred again..,LATIN MAFIA.mp3', 'benjy chord', 'Fred again.. · LATIN MAFIA', 'deep', 'fredagain', ['fred again'], 118),
  t('just-stand-there', 'just stand there : One More Time (Mixed).mp3', 'just stand there : One More Time', 'Fred again.. (edit)', 'amber', 'fredagain', ['fred again'], 126),

  // ── House (8) ──────────────────────────────────────────────────────
  t('make-me-feel', ' Make Me Feel Like.mp3', 'Make Me Feel Like', 'Local', 'warm', 'house', ['house'], 122),
  t('rizz-ayybo', 'RIZZ-AYYBO.mp3', 'RIZZ', 'AYYBO', 'bright', 'house', ['house', 'tech house'], 128),
  t('house-stardust', 'Music Sounds Better With You.mp3', 'Music Sounds Better With You', 'Stardust', 'warm', 'house', ['house', 'classic'], 124),
  t('house-one-more-time', 'One More Time.mp3', 'One More Time', 'Daft Punk', 'bright', 'house', ['house', 'classic'], 123),
  t('house-latch', 'Latch.mp3', 'Latch', 'Disclosure · Sam Smith', 'warm', 'house', ['house', 'classic'], 122),
  t('house-losing-it', 'Losing It.mp3', 'Losing It', 'Fisher', 'bright', 'house', ['house', 'classic'], 125),
  t('house-your-love', ' Your Love.mp3', 'Your Love', 'Frankie Knuckles', 'deep', 'house', ['house', 'classic'], 120),
  t('house-nanana', ' (It Goes Like) Nanana.mp3', '(It Goes Like) Nanana', 'Peggy Gou', 'bright', 'house', ['house', 'classic'], 126),

  // ── Techno (9) ─────────────────────────────────────────────────────
  t('techno-age-of-love', 'The Age Of Love (Charlotte de Witte & Enrico Sangiuliano Remix) .mp3', 'The Age Of Love', 'Charlotte de Witte · Enrico Sangiuliano', 'cool', 'techno', ['techno', 'classic'], 132),
  t('techno-amelie-mind', 'amelie-lens-in-my-mind.mp3', 'In My Mind', 'Amelie Lens', 'cool', 'techno', ['techno', 'classic'], 135),
  t('techno-first-light', 'First Light - Amelie Lens.mp3', 'First Light', 'Amelie Lens', 'cool', 'techno', ['techno'], 134),
  t('techno-trippin', "Trippin' - Amelie Lens.mp3", "Trippin'", 'Amelie Lens', 'cool', 'techno', ['techno'], 133),
  t('techno-for-my-people', 'For My People - I Hate Models.mp3', 'For My People', 'I Hate Models', 'cool', 'techno', ['techno'], 130),
  t('techno-reinier', 'reinier-zonneveld-heute-nacht.mp3', 'Heute Nacht', 'Reinier Zonneveld', 'cool', 'techno', ['techno', 'classic'], 133),
  t('techno-anna', 'anna-hidden-beauties.mp3', 'Hidden Beauties', 'ANNA', 'cool', 'techno', ['techno', 'classic'], 128),
  t('techno-pan-pot', 'Grey Matter - Pan-Pot.mp3', 'Grey Matter', 'Pan-Pot', 'cool', 'techno', ['techno', 'classic'], 126),
  t('techno-len-faki', 'len-faki-bx3.mp3', 'BX3', 'Len Faki', 'cool', 'techno', ['techno', 'classic'], 131),

  // ── Melodic (9) ────────────────────────────────────────────────────
  t('melodic-monument', 'tale-of-us-monument.mp3', 'Monument', 'Tale Of Us · Bodhi', 'mist', 'melodic', ['melodic', 'classic'], 122),
  t('melodic-home', 'adriatique-home.mp3.mp3', 'Home', 'Adriatique', 'deep', 'melodic', ['melodic', 'classic'], 120),
  t('melodic-consciousness', 'anyma-consciousness.mp3', 'Consciousness', 'Anyma · Chris Avantgarde', 'cool', 'melodic', ['melodic', 'classic'], 124),
  t('melodic-breathe', 'camelphat-cristoph-breathe.mp3', 'Breathe', 'CamelPhat · Cristoph · Jem Cooke', 'deep', 'melodic', ['melodic', 'classic'], 122),
  t('melodic-horizon', 'artbat-horizon.mp3', 'Horizon', 'ARTBAT', 'cool', 'melodic', ['melodic', 'classic'], 124),
  t('melodic-feeling', 'massano-the-feeling.mp3', 'The Feeling', 'Massano', 'deep', 'melodic', ['melodic', 'classic'], 126),
  t('melodic-singularity', 'Singularity - Stephan Bodzin.mp3', 'Singularity', 'Stephan Bodzin', 'mist', 'melodic', ['melodic', 'classic'], 123),
  t('melodic-grey-kolsch', 'kolsch-grey.mp3', 'Grey', 'Kölsch', 'cool', 'melodic', ['melodic', 'classic'], 123),
  t('melodic-cause-affection', 'Cause and Affection (Extended Mix) - Enamour.mp3', 'Cause and Affection', 'Enamour', 'deep', 'melodic', ['melodic'], 122),

  // ── Deep House (10) ────────────────────────────────────────────────
  t('no-broke-boys-deep', 'No Broke Boys（Deep House） .mp3', 'No Broke Boys (Deep House)', 'Local', 'deep', 'deep', ['deep house'], 118),
  t('deep-fingerprint', 'lane-8-fingerprint.mp3', 'Fingerprint', 'Lane 8', 'deep', 'deep', ['deep house', 'classic'], 120),
  t('deep-innerbloom', 'rufus-innerbloom.mp3', 'Innerbloom', 'RÜFÜS DU SOL', 'mist', 'deep', ['deep house', 'classic'], 118),
  t('deep-ocean-drive', 'Ocean Drive - Liva K,Duke Dumont.mp3', 'Ocean Drive', 'Duke Dumont', 'warm', 'deep', ['deep house', 'classic'], 120),
  t('deep-piece-of-your-heart', 'meduza-piece-of-your-heart.mp3', 'Piece Of Your Heart', 'Meduza · Goodboys', 'warm', 'deep', ['deep house', 'classic'], 124),
  t('deep-buggin', 'hot-since-82-buggin.mp3', "Buggin'", 'Hot Since 82', 'deep', 'deep', ['deep house', 'classic'], 122),
  t('deep-imagination', 'gorgon-city-imagination.mp3', 'Imagination', 'Gorgon City · Katy Menditta', 'warm', 'deep', ['deep house', 'classic'], 122),
  t('deep-no-eyes', 'claptone-no-eyes.mp3', 'No Eyes', 'Claptone · JAW', 'deep', 'deep', ['deep house', 'classic'], 120),
  t('deep-always', 'mk-always.mp3', 'Always', 'MK · Alana', 'warm', 'deep', ['deep house', 'classic'], 124),
  t('deep-hypnotized', 'purple-disco-machine-hypnotized.mp3', 'Hypnotized', 'Purple Disco Machine · Sophie and the Giants', 'bright', 'deep', ['deep house', 'classic'], 122),

  // ── Trance (10) ────────────────────────────────────────────────────
  t('trance-adagio', 'tiesto-adagio-for-strings.mp3', 'Adagio For Strings', 'Tiësto', 'bright', 'trance', ['trance', 'classic'], 136),
  t('trance-flaming-june', 'bt-flaming-june.mp3', 'Flaming June', 'BT', 'mist', 'trance', ['trance', 'classic'], 136),
  t('trance-saltwater', 'chicane-saltwater.mp3', 'Saltwater', 'Chicane', 'mist', 'trance', ['trance', 'classic'], 132),
  t('trance-gouryella', 'gouryella-gouryella.mp3', 'Gouryella', 'Gouryella', 'bright', 'trance', ['trance', 'classic'], 138),
  t('trance-universal-nation', 'push-universal-nation.mp3', 'Universal Nation', 'Push', 'cool', 'trance', ['trance', 'classic'], 136),
  t('trance-communication', 'armin-communication.mp3', 'Communication', 'Armin van Buuren', 'bright', 'trance', ['trance', 'classic'], 136),
  t('trance-sun-and-moon', 'above-beyond-sun-and-moon.mp3', 'Sun & Moon', 'Above & Beyond', 'mist', 'trance', ['trance', 'classic'], 134),
  t('trance-cafe-del-mar', 'energy-52-cafe-del-mar.mp3', 'Café Del Mar', 'Energy 52', 'mist', 'trance', ['trance', 'classic'], 130),
  t('trance-sandstorm', 'darude-sandstorm..mp3', 'Sandstorm', 'Darude', 'bright', 'trance', ['trance', 'classic'], 136),
  t('trance-punk', 'ferry-corsten-punk', 'Punk', 'Ferry Corsten', 'bright', 'trance', ['trance', 'classic'], 135),

  // ── DnB (10) ───────────────────────────────────────────────────────
  t('starboy-nia', 'Starboy (feat. Daft Punk) : leavemealone : leavemealone (Nia Archives Remix) .mp3', 'Starboy (Nia Archives Remix)', 'The Weeknd · Nia Archives', 'bright', 'dnb', ['dnb', 'remix'], 174),
  t('dnb-timewarp', 'sub-focus-timewarp.mp3', 'Timewarp', 'Sub Focus', 'bright', 'dnb', ['dnb', 'classic'], 174),
  t('dnb-memory-lane', 'netsky-memory-lane..mp3', 'Memory Lane', 'Netsky', 'warm', 'dnb', ['dnb', 'classic'], 172),
  t('dnb-witchcraft', 'pendulum-witchcraft.mp3', 'Witchcraft', 'Pendulum', 'bright', 'dnb', ['dnb', 'classic'], 174),
  t('dnb-climax', 'camo-krooked-climax.mp3', 'Climax', 'Camo & Krooked', 'bright', 'dnb', ['dnb', 'classic'], 176),
  t('dnb-we-are-the-energy', 'metrik-we-are-the-energy.mp3', 'We Are The Energy', 'Metrik', 'bright', 'dnb', ['dnb', 'classic'], 174),
  t('dnb-heartbeat-loud', 'andy-c-heartbeat.mp3', 'Heartbeat Loud', 'Andy C', 'bright', 'dnb', ['dnb', 'classic'], 175),
  t('dnb-oxygen', 'fred-v-grafix-oxygen.mp3', 'Oxygen', 'Fred V & Grafix', 'warm', 'dnb', ['dnb', 'classic'], 173),
  t('dnb-if-we-ever', 'high-contrast-if-we-ever.mp3', 'If We Ever', 'High Contrast · MC GQ', 'warm', 'dnb', ['dnb', 'classic'], 172),
  t('dnb-belle', 'nutone-belle(techno).mp3', 'Belle', 'Nu:Tone', 'deep', 'dnb', ['dnb', 'classic'], 170),

  // ── Extras (mix only) ──────────────────────────────────────────────
  t('extra-murder-vhs', 'Murder on VHS - I Hate Models.mp3', 'Murder on VHS', 'I Hate Models', 'cool', 'techno', ['techno', 'extra'], 132),
  t('extra-cyanure', 'Cyanure Dance - I Hate Models.mp3', 'Cyanure Dance', 'I Hate Models', 'cool', 'techno', ['techno', 'extra'], 130),
  t('extra-nanana-techno', ' (It Goes Like) Nanana（techno）.mp3', '(It Goes Like) Nanana (Techno)', 'Peggy Gou (edit)', 'cool', 'techno', ['techno', 'extra'], 128),
]

export const PLAYLIST: Track[] = CATALOG

export function getTracksForCategory(
  categoryId: CategoryId,
  customTracks: Track[] = [],
): Track[] {
  if (categoryId === 'custom') return customTracks
  if (categoryId === 'mix') return CATALOG
  return CATALOG.filter((track) => track.category === categoryId && !track.tags.includes('extra'))
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

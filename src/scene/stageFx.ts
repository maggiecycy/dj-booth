/** Stage pointer FX queued from App → DJScene */

import type { PropKind } from './propFx'

export type StageFxEvent =
  | { type: 'tap'; x: number; y: number }
  | { type: 'drag'; x: number; y: number }
  | { type: 'mega'; x: number; y: number }
  | { type: 'prop'; kind: PropKind; side: 'left' | 'right' }

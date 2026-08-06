/** Stage pointer FX queued from App → DJScene */

export type StageFxEvent =
  | { type: 'tap'; x: number; y: number }
  | { type: 'drag'; x: number; y: number }
  | { type: 'mega'; x: number; y: number }

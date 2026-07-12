import type { RuntimeNumeric } from '@utility'

export interface BeatRange {
  readonly start: RuntimeNumeric<'beats'>
  readonly end?: RuntimeNumeric<'beats'>
}

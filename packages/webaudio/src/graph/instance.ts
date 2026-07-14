import type { NoteEvent } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'

export interface Instance {
  readonly dispose: () => void

  readonly input?: AudioNode
  readonly output?: AudioNode

  readonly triggerNote?: (note: NoteEvent, tempo: Numeric<'bpm'>) => void
}

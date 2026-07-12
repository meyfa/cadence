import type { NoteEvent } from '@core'
import type { Numeric } from '@utility'

export interface Instance {
  readonly dispose: () => void

  readonly input?: AudioNode
  readonly output?: AudioNode

  readonly triggerNote?: (note: NoteEvent, tempo: Numeric<'bpm'>) => void
}

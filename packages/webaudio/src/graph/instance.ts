import type { NoteOptions } from '@audiograph'

export interface Instance {
  readonly dispose: () => void

  readonly input?: AudioNode
  readonly output?: AudioNode

  readonly triggerNote?: (options: NoteOptions) => void
}

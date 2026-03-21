import type { NoteOptions } from '@audiograph/graph.js'

export interface Instance {
  readonly loaded: Promise<void>
  readonly dispose: () => void

  readonly input?: AudioNode
  readonly output?: AudioNode

  readonly triggerNote?: (options: NoteOptions) => void
}

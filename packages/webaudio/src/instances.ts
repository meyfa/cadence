import type { Pitch } from '@core/program.js'

export interface Instance {
  readonly loaded: Promise<void>
  readonly dispose: () => void

  readonly input?: AudioNode
  readonly output?: AudioNode

  readonly triggerNote?: (options: NoteOptions) => void
}

export interface NoteOptions {
  readonly note: Pitch | number
  readonly time: number
  readonly velocity: number
  readonly duration?: number
}

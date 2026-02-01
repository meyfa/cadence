import type { Pitch } from '@core/program.js'

export interface BaseMixin {
  readonly loaded: Promise<void>
  readonly dispose: () => void
}

export interface InputMixin {
  readonly input: AudioNode
}

export interface OutputMixin {
  readonly output: AudioNode
}

export interface NoteOptions {
  readonly note: Pitch | number
  readonly time: number
  readonly velocity: number
  readonly duration?: number
}

export interface InstrumentInstance extends BaseMixin, OutputMixin {
  readonly triggerNote: (options: NoteOptions) => void
}

export interface BusInstance extends BaseMixin, InputMixin, OutputMixin {}

export interface EffectInstance extends BaseMixin, InputMixin, OutputMixin {}

import type { ToneAudioNode } from 'tone'

export interface BaseMixin {
  readonly loaded: Promise<void>
  readonly dispose: () => void
}

export interface InputMixin {
  readonly input: ToneAudioNode
}

export interface OutputMixin {
  readonly output: ToneAudioNode
}

export type TriggerAttack = (note: string | number, time?: number, velocity?: number) => void
export type TriggerRelease = (note: string | number, time?: number) => void

export interface InstrumentInstance extends BaseMixin, OutputMixin {
  readonly triggerAttack: TriggerAttack
  readonly triggerRelease: TriggerRelease
}

export interface BusInstance extends BaseMixin, InputMixin, OutputMixin {}

export interface EffectInstance extends BaseMixin, InputMixin, OutputMixin {}

export interface PartInstance extends BaseMixin {
  readonly start: (time?: number) => void
}

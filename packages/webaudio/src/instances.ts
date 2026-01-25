import type { InputNode, ToneAudioNode } from 'tone'

export interface BaseMixin {
  readonly loaded: Promise<void>
  readonly dispose: () => void
}

export interface InputMixin {
  readonly input: ToneAudioNode | AudioNode
}

export interface OutputMixin {
  readonly output: ToneAudioNode | AudioNode
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

export function connect (source: OutputMixin, destination: InputMixin): void {
  const output = getNativeOutput(source.output)
  const input = getNativeInput(destination.input)

  if (output != null && input != null) {
    output.connect(input)
  }
}

function getNativeInput (node: InputNode): AudioNode | undefined {
  if ('input' in node && node.input != null) {
    return getNativeInput(node.input)
  }

  return node as AudioNode
}

function getNativeOutput (node: ToneAudioNode | AudioNode): AudioNode | undefined {
  if ('output' in node && node.output != null) {
    return getNativeOutput(node.output)
  }

  return node as AudioNode
}

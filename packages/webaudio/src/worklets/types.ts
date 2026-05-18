export type AudioWorkletProcessInputs = ReadonlyArray<readonly Float32Array[]>

export type AudioWorkletProcessOutputs = Array<Array<Float32Array | undefined> | undefined>

export interface AudioWorkletProcessor {
  readonly port: MessagePort
  process(
    inputs: AudioWorkletProcessInputs,
    outputs: AudioWorkletProcessOutputs,
    parameters: Record<string, Float32Array>
  ): boolean
}

type AudioWorkletProcessorConstructor = new () => AudioWorkletProcessor

export interface AudioWorkletGlobalScope {
  readonly AudioWorkletProcessor: AudioWorkletProcessorConstructor
  readonly currentTime: number
  registerProcessor(name: string, processorCtor: AudioWorkletProcessorConstructor): void
}

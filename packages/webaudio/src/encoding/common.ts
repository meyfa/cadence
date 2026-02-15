/**
 * An object akin to Web Audio's AudioBuffer, but without any browser-specific APIs.
 */
export interface AudioBufferLike {
  readonly sampleRate: number
  readonly length: number
  readonly numberOfChannels: number

  readonly copyFromChannel: (dest: Float32Array<ArrayBuffer>, channel: number, start: number) => void
}

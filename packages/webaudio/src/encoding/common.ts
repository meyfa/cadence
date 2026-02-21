/**
 * An object akin to Web Audio's AudioBuffer, but without any browser-specific APIs.
 */
export interface AudioBufferLike {
  readonly sampleRate: number

  /**
   * Length in sample-frames (i.e. samples per channel).
   */
  readonly length: number
  readonly numberOfChannels: number

  readonly copyFromChannel: (dest: Float32Array<ArrayBuffer>, channel: number, start: number) => void
}

/**
 * A rudimentary description of audio data which can be used for estimating the resulting file size.
 */
export interface AudioDescription {
  /**
   * Length in sample-frames (i.e. samples per channel).
   */
  readonly length: number
  readonly numberOfChannels: number
}

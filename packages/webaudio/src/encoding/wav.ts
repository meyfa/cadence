import type { AudioBufferLike, AudioDescription } from './common.js'
import { getBitsPerSample, writeAudioData, writeStringData, writeUint16LE, writeUint32LE, type FloatSampleBits, type PCMFormat, type PCMSampleBits } from './pcm-io.js'

export type WAVFormat = `pcm${PCMSampleBits}` | `float${FloatSampleBits}`

export interface WAVEncodingOptions {
  readonly format: WAVFormat
}

const Constants = Object.freeze({
  FileTypeRiff: 'RIFF',
  FileFormatWave: 'WAVE',
  BlockIdFormat: 'fmt ',
  BlockIdData: 'data'
})

const toPCMFormat = (format: WAVFormat): PCMFormat => `${format}le`

/**
 * Estimate the size of a WAV file (in bytes) given information about the audio data and encoding options.
 */
export function estimateWAVSize (audio: AudioDescription, options: WAVEncodingOptions): number {
  const bitsPerSample = getBitsPerSample(toPCMFormat(options.format))
  const blockAlign = audio.numberOfChannels * bitsPerSample / 8
  const dataSize = audio.length * blockAlign

  // headers size (RIFF chunk + fmt subchunk + data subchunk)
  const headersSize = 44

  return headersSize + dataSize
}

/**
 * Encode an audio buffer as a WAV file.
 */
export function encodeWAV (audio: AudioBufferLike, options: WAVEncodingOptions): ArrayBuffer {
  const pcmFormat = toPCMFormat(options.format)

  const numChannels = audio.numberOfChannels
  const sampleRate = audio.sampleRate

  const bitsPerSample = getBitsPerSample(pcmFormat)

  const blockAlign = numChannels * bitsPerSample / 8
  const byteRate = sampleRate * blockAlign

  // 1 = PCM, 3 = IEEE float
  const audioFormat = options.format === 'float32' ? 3 : 1

  const headersSize = 44
  const dataSize = audio.length * blockAlign

  const buffer = new ArrayBuffer(headersSize + dataSize)
  const view = new DataView(buffer)

  // See: https://en.wikipedia.org/wiki/WAV#WAV_file_header

  let offset = 0

  // Master RIFF chunk
  offset += writeStringData(view, offset, Constants.FileTypeRiff)
  offset += writeUint32LE(view, offset, buffer.byteLength - 8)
  offset += writeStringData(view, offset, Constants.FileFormatWave)

  // fmt subchunk
  const fmtChunkSize = 16
  offset += writeStringData(view, offset, Constants.BlockIdFormat)
  offset += writeUint32LE(view, offset, fmtChunkSize)

  offset += writeUint16LE(view, offset, audioFormat)
  offset += writeUint16LE(view, offset, numChannels)
  offset += writeUint32LE(view, offset, sampleRate)
  offset += writeUint32LE(view, offset, byteRate)
  offset += writeUint16LE(view, offset, blockAlign)
  offset += writeUint16LE(view, offset, bitsPerSample)

  // data subchunk
  offset += writeStringData(view, offset, Constants.BlockIdData)
  offset += writeUint32LE(view, offset, dataSize)

  writeAudioData(view, offset, audio, pcmFormat)

  return buffer
}

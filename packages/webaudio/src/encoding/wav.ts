import type { AudioBufferLike } from './common.js'

type PCMSampleBits = 16 | 24 | 32
type FloatSampleBits = 32

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

export function encodeWAV (audio: AudioBufferLike, options: WAVEncodingOptions): ArrayBuffer {
  const numChannels = audio.numberOfChannels
  const sampleRate = audio.sampleRate

  const bitsPerSample = getBitsPerSample(options.format)

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
  offset += writeString(view, offset, Constants.FileTypeRiff)
  offset += writeUint32(view, offset, buffer.byteLength - 8)
  offset += writeString(view, offset, Constants.FileFormatWave)

  // fmt subchunk
  const fmtChunkSize = 16
  offset += writeString(view, offset, Constants.BlockIdFormat)
  offset += writeUint32(view, offset, fmtChunkSize)

  offset += writeUint16(view, offset, audioFormat)
  offset += writeUint16(view, offset, numChannels)
  offset += writeUint32(view, offset, sampleRate)
  offset += writeUint32(view, offset, byteRate)
  offset += writeUint16(view, offset, blockAlign)
  offset += writeUint16(view, offset, bitsPerSample)

  // data subchunk
  offset += writeString(view, offset, Constants.BlockIdData)
  offset += writeUint32(view, offset, dataSize)

  writeAudioData(view, offset, audio, options)

  return buffer
}

function getBitsPerSample (format: WAVFormat): PCMSampleBits | FloatSampleBits {
  switch (format) {
    case 'pcm16': return 16
    case 'pcm24': return 24
    case 'pcm32': return 32
    case 'float32': return 32
  }
}

function getSampleWriter (format: WAVFormat): WriteFn<number> {
  switch (format) {
    case 'pcm16':
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x8000, Math.min(0x7FFF, Math.round(float * 0x8000)))
        view.setInt16(offset, int, true)
        return 2
      }

    case 'pcm24':
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x800000, Math.min(0x7FFFFF, Math.round(float * 0x800000)))
        view.setUint8(offset, int & 0xFF)
        view.setUint8(offset + 1, (int >>> 8) & 0xFF)
        view.setUint8(offset + 2, (int >>> 16) & 0xFF)
        return 3
      }

    case 'pcm32':
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x80000000, Math.min(0x7FFFFFFF, Math.round(float * 0x80000000)))
        view.setInt32(offset, int, true)
        return 4
      }

    case 'float32':
      return (view, offset, sample) => {
        view.setFloat32(offset, sample, true)
        return 4
      }
  }
}

function writeAudioData (view: DataView, offset: number, audio: AudioBufferLike, options: WAVEncodingOptions): void {
  const writeSample = getSampleWriter(options.format)
  const numChannels = audio.numberOfChannels

  // process in chunks as recommended by the Web Audio API spec to avoid large allocations
  const bufferSize = 4096
  const buffers = Array.from({ length: numChannels }, () => new Float32Array(bufferSize))

  for (let i = 0; i < audio.length; i += bufferSize) {
    const chunkSize = Math.min(bufferSize, audio.length - i)

    for (let channel = 0; channel < numChannels; ++channel) {
      audio.copyFromChannel(buffers[channel], channel, i)
    }

    for (let j = 0; j < chunkSize; ++j) {
      for (let channel = 0; channel < numChannels; ++channel) {
        offset += writeSample(view, offset, buffers[channel][j])
      }
    }
  }
}

type WriteFn<T> = (view: DataView, offset: number, value: T) => number

const writeString: WriteFn<string> = (view, offset, str) => {
  for (let i = 0; i < str.length; ++i) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }

  return str.length
}

const writeUint16: WriteFn<number> = (view, offset, value) => {
  view.setUint16(offset, value, true)
  return 2
}

const writeUint32: WriteFn<number> = (view, offset, value) => {
  view.setUint32(offset, value, true)
  return 4
}

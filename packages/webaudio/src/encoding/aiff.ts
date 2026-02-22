import type { AudioBufferLike, AudioDescription } from './common.js'
import { getBitsPerSample, writeAudioData, writeExtended80, writeStringData, writeUint16BE, writeUint32BE, type FloatSampleBits, type PCMFormat, type PCMSampleBits } from './pcm-io.js'

export type AIFFFormat = `pcm${PCMSampleBits}` | `float${FloatSampleBits}`

export interface AIFFEncodingOptions {
  readonly format: AIFFFormat
}

const Constants = Object.freeze({
  FileTypeForm: 'FORM',
  FileFormatAiff: 'AIFF',
  FileFormatAifc: 'AIFC',
  ChunkIdFver: 'FVER',
  ChunkIdComm: 'COMM',
  ChunkIdSsnd: 'SSND',
  CompressionTypeFloat32: 'fl32',
  CompressionNameFloat32: 'Float32',
  AifcVersion: 0xA280_5140
})

const toPCMFormat = (format: AIFFFormat): PCMFormat => `${format}be`

/**
 * Estimate the size of an AIFF/AIFC file (in bytes) given information about the audio data and encoding options.
 */
export function estimateAIFFSize (audio: AudioDescription, options: AIFFEncodingOptions): number {
  const numChannels = audio.numberOfChannels
  const bitsPerSample = getBitsPerSample(toPCMFormat(options.format))
  const dataSize = audio.length * numChannels * (bitsPerSample / 8)

  // AIFC includes a format version chunk
  const fverSize = options.format === 'float32' ? 12 : 0

  const commChunkSize = getCommChunkSize(options.format)
  const commPad = padByteCount(commChunkSize)

  // SSND chunk: offset (4) + blockSize (4) + audio data
  const ssndChunkSize = 8 + dataSize
  const ssndPad = padByteCount(ssndChunkSize)

  // FORM chunk: 'FORM'(4) + size(4) + formType(4) + chunks...
  return 12 + fverSize + (8 + commChunkSize + commPad) + (8 + ssndChunkSize + ssndPad)
}

/**
 * Encode an audio buffer as an AIFF/AIFC file.
 * Integer PCM formats are encoded as AIFF. 'float32' is encoded as AIFC with compression type fl32.
 */
export function encodeAIFF (audio: AudioBufferLike, options: AIFFEncodingOptions): ArrayBuffer {
  const pcmFormat = toPCMFormat(options.format)

  const numChannels = audio.numberOfChannels
  const numSampleFrames = audio.length
  const sampleRate = audio.sampleRate

  const bitsPerSample = getBitsPerSample(pcmFormat)
  const dataSize = numSampleFrames * numChannels * (bitsPerSample / 8)

  const commChunkSize = getCommChunkSize(options.format)
  const commPad = padByteCount(commChunkSize)

  const ssndChunkSize = 8 + dataSize
  const ssndPad = padByteCount(ssndChunkSize)

  const fverSize = options.format === 'float32' ? 12 : 0

  const fileSize = 12 + fverSize + (8 + commChunkSize + commPad) + (8 + ssndChunkSize + ssndPad)
  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)

  const isFloat = options.format === 'float32'
  const formType = isFloat ? Constants.FileFormatAifc : Constants.FileFormatAiff

  let offset = 0

  // FORM chunk
  offset += writeStringData(view, offset, Constants.FileTypeForm)
  offset += writeUint32BE(view, offset, buffer.byteLength - 8)
  offset += writeStringData(view, offset, formType)

  if (isFloat) {
    // AIFC format version chunk
    offset += writeStringData(view, offset, Constants.ChunkIdFver)
    offset += writeUint32BE(view, offset, 4)
    offset += writeUint32BE(view, offset, Constants.AifcVersion)
  }

  // COMM chunk
  offset += writeStringData(view, offset, Constants.ChunkIdComm)
  offset += writeUint32BE(view, offset, commChunkSize)

  offset += writeUint16BE(view, offset, numChannels)
  offset += writeUint32BE(view, offset, numSampleFrames)
  offset += writeUint16BE(view, offset, bitsPerSample)
  offset += writeExtended80(view, offset, sampleRate)

  if (isFloat) {
    offset += writeStringData(view, offset, Constants.CompressionTypeFloat32)
    offset += writePString(view, offset, Constants.CompressionNameFloat32)
  }

  offset += writePad(view, offset, commPad)

  // SSND chunk
  offset += writeStringData(view, offset, Constants.ChunkIdSsnd)
  offset += writeUint32BE(view, offset, ssndChunkSize)
  offset += writeUint32BE(view, offset, 0) // offset
  offset += writeUint32BE(view, offset, 0) // block size

  writeAudioData(view, offset, audio, pcmFormat)
  offset += dataSize

  offset += writePad(view, offset, ssndPad)

  return buffer
}

function getCommChunkSize (format: AIFFFormat): number {
  if (format !== 'float32') {
    return 18
  }

  // AIFC COMM chunk extends AIFF COMM with:
  // - compressionType: 4 bytes
  // - compressionName: Pascal string (1 byte length + chars), padded to even
  const pStringSize = 1 + Constants.CompressionNameFloat32.length
  const pStringPad = padByteCount(pStringSize)

  return 18 + 4 + pStringSize + pStringPad
}

function padByteCount (size: number): 0 | 1 {
  return (size % 2 === 0) ? 0 : 1
}

function writePad (view: DataView, offset: number, count: 0 | 1): number {
  if (count === 0) {
    return 0
  }

  view.setUint8(offset, 0)
  return 1
}

function writePString (view: DataView, offset: number, str: string): number {
  const length = Math.min(255, str.length)

  view.setUint8(offset, length)

  for (let i = 0; i < length; ++i) {
    view.setUint8(offset + 1 + i, str.charCodeAt(i))
  }

  const size = 1 + length
  const pad = padByteCount(size)
  if (pad > 0) {
    view.setUint8(offset + size, 0)
  }

  return size + pad
}

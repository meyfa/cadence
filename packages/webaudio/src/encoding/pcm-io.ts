import type { AudioBufferLike } from './common.js'

/**
 * Write an entity to a DataView at the given offset, and return the number of bytes written.
 */
export type WriteFn<T> = (view: DataView, offset: number, value: T) => number

export type Endian = 'be' | 'le'

export type PCMSampleBits = 16 | 24 | 32
export type FloatSampleBits = 32

export type PCMFormat = `pcm${PCMSampleBits}${Endian}` | `float${FloatSampleBits}${Endian}`

export function getBitsPerSample (format: PCMFormat): PCMSampleBits | FloatSampleBits {
  switch (format) {
    case 'pcm16le': return 16
    case 'pcm16be': return 16
    case 'pcm24le': return 24
    case 'pcm24be': return 24
    case 'pcm32le': return 32
    case 'pcm32be': return 32
    case 'float32le': return 32
    case 'float32be': return 32
  }
}

function getSampleWriter (format: PCMFormat): WriteFn<number> {
  switch (format) {
    case 'pcm16le':
    case 'pcm16be': {
      const littleEndian = format === 'pcm16le'
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x8000, Math.min(0x7FFF, Math.round(float * 0x8000)))
        view.setInt16(offset, int, littleEndian)
        return 2
      }
    }

    case 'pcm24le':
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x800000, Math.min(0x7FFFFF, Math.round(float * 0x800000)))
        view.setUint8(offset, int & 0xFF)
        view.setUint8(offset + 1, (int >>> 8) & 0xFF)
        view.setUint8(offset + 2, (int >>> 16) & 0xFF)
        return 3
      }

    case 'pcm24be':
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x800000, Math.min(0x7FFFFF, Math.round(float * 0x800000)))
        view.setUint8(offset, (int >>> 16) & 0xFF)
        view.setUint8(offset + 1, (int >>> 8) & 0xFF)
        view.setUint8(offset + 2, int & 0xFF)
        return 3
      }

    case 'pcm32le':
    case 'pcm32be': {
      const littleEndian = format === 'pcm32le'
      return (view, offset, sample) => {
        const float = Math.max(-1, Math.min(1, sample))
        const int = Math.max(-0x80000000, Math.min(0x7FFFFFFF, Math.round(float * 0x80000000)))
        view.setInt32(offset, int, littleEndian)
        return 4
      }
    }

    case 'float32le':
    case 'float32be': {
      const littleEndian = format === 'float32le'
      return (view, offset, sample) => {
        view.setFloat32(offset, sample, littleEndian)
        return 4
      }
    }
  }
}

export function writeAudioData (view: DataView, offset: number, audio: AudioBufferLike, format: PCMFormat): void {
  const writeSample = getSampleWriter(format)
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

export const writeStringData: WriteFn<string> = (view, offset, str) => {
  for (let i = 0; i < str.length; ++i) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }

  return str.length
}

export const writeUint16BE: WriteFn<number> = (view, offset, value) => {
  view.setUint16(offset, value, false)
  return 2
}

export const writeUint16LE: WriteFn<number> = (view, offset, value) => {
  view.setUint16(offset, value, true)
  return 2
}

export const writeUint32BE: WriteFn<number> = (view, offset, value) => {
  view.setUint32(offset, value, false)
  return 4
}

export const writeUint32LE: WriteFn<number> = (view, offset, value) => {
  view.setUint32(offset, value, true)
  return 4
}

/**
 * Write IEEE 754 80-bit extended float.
 */
export function writeExtended80 (view: DataView, offset: number, value: number): number {
  if (value === 0 || !Number.isFinite(value)) {
    // Treat non-finite values as 0 to keep output deterministic.
    for (let i = 0; i < 10; ++i) {
      view.setUint8(offset + i, 0)
    }
    return 10
  }

  const sign = value < 0 ? 0x8000 : 0
  const abs = Math.abs(value)

  const exp = Math.floor(Math.log2(abs))
  const exponent = exp + 16383

  let mantissa: bigint
  if (Number.isInteger(abs) && abs <= 0xFFFF_FFFF) {
    mantissa = BigInt(abs) << BigInt(63 - exp)
  } else {
    const normalized = abs / Math.pow(2, exp) // in [1,2)
    mantissa = BigInt(Math.floor(normalized * Math.pow(2, 63)))
  }

  view.setUint16(offset, sign | exponent, false)

  const hi = Number((mantissa >> 32n) & 0xFFFF_FFFFn)
  const lo = Number(mantissa & 0xFFFF_FFFFn)
  view.setUint32(offset + 2, hi, false)
  view.setUint32(offset + 6, lo, false)

  return 10
}

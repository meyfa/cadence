import type { AudioGraph, Node } from '@audiograph'
import { AudioBufferLike, AudioDescription, encodeAIFF, encodeWAV, estimateAIFFSize, estimateWAVSize, type AIFFEncodingOptions, type AIFFFormat, type AudioBufferTransform, type WAVEncodingOptions, type WAVFormat } from '@codecs'
import { beatsToSeconds, calculateTotalLength, type Program } from '@core'
import { numeric, type Numeric } from '@utility'
import { createAudioRenderer } from '@webaudio'
import { type Option } from '../../components/dropdown/Dropdown.js'
import { saveFile } from '../../utilities/files.js'

const ASSET_LOAD_TIMEOUT = numeric('s', 30)

export const MAX_EXPORT_DURATION = numeric('s', 60 * 60) // 1 hour
export const RENDER_CHANNELS = 2 // stereo

export type FileType = 'wav' | 'aiff'
export type SampleRate = '44100' | '48000' | '96000'

interface ExportFileType<TEncodingOptions = never> {
  readonly extension: string
  readonly mimeType: string
  readonly estimateSize: (audio: AudioDescription, options: TEncodingOptions) => Numeric<'bytes'>
  readonly encode: (audio: AudioBufferLike, options: TEncodingOptions) => ArrayBuffer
}

export const WAV: ExportFileType<WAVEncodingOptions> = {
  extension: 'wav',
  mimeType: 'audio/wav',
  estimateSize: estimateWAVSize,
  encode: encodeWAV
}

export const AIFF: ExportFileType<AIFFEncodingOptions> = {
  extension: 'aiff',
  mimeType: 'audio/aiff',
  estimateSize: estimateAIFFSize,
  encode: encodeAIFF
}

export const FILE_TYPE_OPTIONS: readonly Option[] = [
  { label: 'WAV', value: 'wav' },
  { label: 'AIFF', value: 'aiff' }
]

export const WAV_FORMAT_OPTIONS: readonly Option[] = [
  { label: 'Float 32-bit', value: 'float32' },
  { label: 'PCM 16-bit', value: 'pcm16' },
  { label: 'PCM 24-bit', value: 'pcm24' },
  { label: 'PCM 32-bit', value: 'pcm32' }
]

export const AIFF_FORMAT_OPTIONS: readonly Option[] = [
  { label: 'Float 32-bit', value: 'float32' },
  { label: 'PCM 16-bit', value: 'pcm16' },
  { label: 'PCM 24-bit', value: 'pcm24' },
  { label: 'PCM 32-bit', value: 'pcm32' }
]

export const SAMPLE_RATE_OPTIONS: readonly Option[] = [
  { label: '44.1 kHz', value: '44100' },
  { label: '48 kHz', value: '48000' },
  { label: '96 kHz', value: '96000' }
]

export const LEADING_SILENCE_OPTIONS: readonly Option[] = [
  { label: 'None', value: '0.000' },
  { label: '0.100s', value: '0.100' },
  { label: '0.250s', value: '0.250' },
  { label: '0.500s', value: '0.500' },
  { label: '1.000s', value: '1.000' }
]

function getDefaultFileName (type: ExportFileType): string {
  return `track.${type.extension}`
}

export async function renderAndSave<TEncodingOptions> (
  graph: AudioGraph<Node>,
  sampleRate: number,
  transforms: readonly AudioBufferTransform[],
  onProgress: (progress: number) => void,
  type: ExportFileType<TEncodingOptions>,
  options: TEncodingOptions
): Promise<readonly Error[]> {
  const renderer = createAudioRenderer({
    assetLoadTimeout: ASSET_LOAD_TIMEOUT,
    cacheLimits: {
      arrayBuffer: numeric('bytes', 0),
      audioBuffer: numeric('bytes', 0)
    }
  })

  const { audioBuffer, errors } = await renderer.render(graph, {
    channels: RENDER_CHANNELS,
    sampleRate,
    onProgress
  })
  if (audioBuffer == null || errors.length > 0) {
    return errors
  }

  const transformedBuffer = transforms.reduce<AudioBufferLike>((buffer, transform) => transform(buffer), audioBuffer)

  const encoded = type.encode(transformedBuffer, options)

  const content = new Blob([encoded], { type: type.mimeType })
  const filename = getDefaultFileName(type)

  saveFile({ content, filename })

  return errors
}

export interface ExportMetrics {
  readonly duration: Numeric<'s'>
  readonly fileSize: Numeric<'bytes'>
}

export function computeExportMetrics (program: Program, options: {
  readonly sampleRate: SampleRate
  readonly leadingSilence: Numeric<'s'>
  readonly type: FileType
  readonly wavFormat: WAVFormat
  readonly aiffFormat: AIFFFormat
}): ExportMetrics {
  const trackLength = computeTrackDuration(program)
  const duration = numeric('s', trackLength.value + options.leadingSilence.value)

  const fileSize = estimateFileSize({ ...options, duration })

  return { duration, fileSize }
}

function computeTrackDuration (program: Program): Numeric<'s'> {
  const lengthInBeats = calculateTotalLength(program)
  return beatsToSeconds(lengthInBeats, program.track.tempo)
}

function estimateFileSize (options: {
  readonly duration: Numeric<'s'>
  readonly sampleRate: SampleRate
  readonly type: FileType
  readonly wavFormat: WAVFormat
  readonly aiffFormat: AIFFFormat
}): Numeric<'bytes'> {
  const { duration, sampleRate, type, wavFormat, aiffFormat } = options

  const exportType = type === 'wav' ? WAV : AIFF
  const format = type === 'wav' ? wavFormat : aiffFormat

  const description: AudioDescription = {
    length: Math.ceil(duration.value * Number.parseInt(sampleRate, 10)),
    numberOfChannels: RENDER_CHANNELS
  }

  return exportType.estimateSize(description, { format })
}

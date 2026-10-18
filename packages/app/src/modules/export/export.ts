import type { AudioGraph, Node } from '@meyfa/cadence-audiograph'
import type { AudioBufferLike, AudioBufferTransform } from '@meyfa/cadence-codecs'
import { createLeadingSilenceTransform } from '@meyfa/cadence-codecs'
import type { Numeric } from '@meyfa/cadence-utility'
import { createAudioRenderer } from '@meyfa/cadence-webaudio'
import { saveFile } from '../../utilities/files.ts'
import type { ExportFileType, ExportForm } from './form.ts'
import { getDefaultFileName, getEncodingOptions, getFileType, getLeadingSilence, getSampleRate } from './form.ts'

export const MAX_EXPORT_DURATION = (60 * 60) as Numeric<'s'> // 1 hour
export const EXPORT_CHANNELS = 2 // stereo
const ASSET_LOAD_TIMEOUT = 30 as Numeric<'s'>

export type ProgressCallback = (progress: number) => void

export async function exportAudio (graph: AudioGraph<Node>, form: ExportForm, onProgress: ProgressCallback): Promise<readonly Error[]> {
  const type = getFileType(form)
  const encodingOptions = getEncodingOptions(form, type)
  const sampleRate = getSampleRate(form)
  const leadingSilence = getLeadingSilence(form)

  const transforms = [
    createLeadingSilenceTransform(leadingSilence)
  ]

  const filename = getDefaultFileName(type)
  const { errors, content } = await renderAudio(graph, type, encodingOptions, sampleRate, transforms, onProgress)

  if (content != null) {
    saveFile({ content, filename })
  }

  return errors
}

interface RenderResult {
  readonly errors: readonly Error[]
  readonly content?: Blob
}

async function renderAudio<TEncodingOptions> (
  graph: AudioGraph<Node>,
  type: ExportFileType<TEncodingOptions>,
  options: TEncodingOptions,
  sampleRate: number,
  transforms: readonly AudioBufferTransform[],
  onProgress: (progress: number) => void
): Promise<RenderResult> {
  const renderer = createAudioRenderer({
    assetLoadTimeout: ASSET_LOAD_TIMEOUT,
    cacheLimits: {
      arrayBuffer: 0 as Numeric<'bytes'>,
      audioBuffer: 0 as Numeric<'bytes'>
    }
  })

  const { audioBuffer, errors } = await renderer.render(graph, {
    channels: EXPORT_CHANNELS,
    sampleRate,
    onProgress
  })
  if (audioBuffer == null || errors.length > 0) {
    return { errors }
  }

  const transformed = applyTransforms(audioBuffer, transforms)
  const encoded = type.encode(transformed, options)
  const content = new Blob([encoded], { type: type.mimeType })

  return { errors, content }
}

function applyTransforms (buffer: AudioBuffer, transforms: readonly AudioBufferTransform[]): AudioBufferLike {
  return transforms.reduce<AudioBufferLike>((buf, transform) => transform(buf), buffer)
}

import type { AudioDescription } from '@meyfa/cadence-codecs'
import type { Program } from '@meyfa/cadence-core'
import { beatsToSeconds, calculateTotalLength } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { EXPORT_CHANNELS } from './export.ts'
import type { ExportForm } from './form.ts'
import { getEncodingOptions, getFileType, getLeadingSilence, getSampleRate } from './form.ts'

export interface ExportMetrics {
  readonly duration: Numeric<'s'>
  readonly fileSize: Numeric<'bytes'>
}

export function computeExportMetrics (program: Program, form: ExportForm): ExportMetrics {
  const leadingSilence = getLeadingSilence(form)

  const trackLength = computeTrackLength(program)
  const duration = (trackLength + leadingSilence) as Numeric<'s'>

  const fileSize = estimateFileSize(duration, form)

  return { duration, fileSize }
}

function computeTrackLength (program: Program): Numeric<'s'> {
  const lengthInBeats = calculateTotalLength(program)
  return beatsToSeconds(lengthInBeats, program.track.tempo)
}

function estimateFileSize (duration: Numeric<'s'>, form: ExportForm): Numeric<'bytes'> {
  const type = getFileType(form)
  const encodingOptions = getEncodingOptions(form, type)
  const sampleRate = getSampleRate(form)

  const description: AudioDescription = {
    length: Math.ceil(duration * sampleRate),
    numberOfChannels: EXPORT_CHANNELS
  }

  return type.estimateSize(description, encodingOptions)
}

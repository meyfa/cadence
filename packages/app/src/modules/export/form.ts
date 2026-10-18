import type { AIFFEncodingOptions, AudioBufferLike, AudioDescription, WAVEncodingOptions } from '@meyfa/cadence-codecs'
import { estimateAIFFSize, estimateWAVSize, encodeAIFF, encodeWAV } from '@meyfa/cadence-codecs'
import type { Option } from '../../components/dropdown/Dropdown.ts'
import type { Numeric } from '@meyfa/cadence-utility'

export interface ExportField {
  readonly key: string
  readonly label: string
  readonly options: readonly Option[]
}

export type ExportForm = Readonly<Record<string, unknown>>

export function updateExportForm (form: ExportForm, field: ExportField, value: string): ExportForm {
  return {
    ...form,
    [field.key]: value
  }
}

export function getExportFormValue (form: ExportForm, field: ExportField): string {
  const value = form[field.key]
  if (typeof value === 'string') {
    return value
  }

  const defaultValue = field.options.at(0)?.value
  if (defaultValue != null) {
    return defaultValue
  }

  throw new Error(`Missing default for "${field.key}"`)
}

// file types

export interface ExportFileType<TEncodingOptions = never> {
  readonly extension: string
  readonly mimeType: string
  readonly estimateSize: (audio: AudioDescription, options: TEncodingOptions) => Numeric<'bytes'>
  readonly encode: (audio: AudioBufferLike, options: TEncodingOptions) => ArrayBuffer
}

const WAV: ExportFileType<WAVEncodingOptions> = {
  extension: 'wav',
  mimeType: 'audio/wav',
  estimateSize: estimateWAVSize,
  encode: encodeWAV
}

const AIFF: ExportFileType<AIFFEncodingOptions> = {
  extension: 'aiff',
  mimeType: 'audio/aiff',
  estimateSize: estimateAIFFSize,
  encode: encodeAIFF
}

export function getDefaultFileName (type: ExportFileType): string {
  return `track.${type.extension}`
}

// form fields

const typeField: ExportField = {
  key: 'type',
  label: 'File type',
  options: [
    { label: 'WAV', value: 'wav' },
    { label: 'AIFF', value: 'aiff' }
  ]
}

const sampleRateField: ExportField = {
  key: 'sampleRate',
  label: 'Sample rate',
  options: [
    { label: '44.1 kHz', value: '44100' },
    { label: '48 kHz', value: '48000' },
    { label: '96 kHz', value: '96000' }
  ]
}

const leadingSilenceField: ExportField = {
  key: 'leadingSilence',
  label: 'Leading silence',
  options: [
    { label: 'None', value: '0.000' },
    { label: '0.100s', value: '0.100' },
    { label: '0.250s', value: '0.250' },
    { label: '0.500s', value: '0.500' },
    { label: '1.000s', value: '1.000' }
  ]
}

const wavFormatField: ExportField = {
  key: 'wav.format',
  label: 'WAV format',
  options: [
    { label: 'Float 32-bit', value: 'float32' },
    { label: 'PCM 16-bit', value: 'pcm16' },
    { label: 'PCM 24-bit', value: 'pcm24' },
    { label: 'PCM 32-bit', value: 'pcm32' }
  ]
}

const aiffFormatField: ExportField = {
  key: 'aiff.format',
  label: 'AIFF format',
  options: [
    { label: 'Float 32-bit', value: 'float32' },
    { label: 'PCM 16-bit', value: 'pcm16' },
    { label: 'PCM 24-bit', value: 'pcm24' },
    { label: 'PCM 32-bit', value: 'pcm32' }
  ]
}

// form construction

const commonFields = [sampleRateField, leadingSilenceField]
const wavFields = [wavFormatField]
const aiffFields = [aiffFormatField]

export function getExportFields (form: ExportForm): readonly ExportField[] {
  const fields: ExportField[] = [typeField]

  switch (getFileType(form)) {
    case WAV:
      fields.push(...wavFields)
      break
    case AIFF:
      fields.push(...aiffFields)
      break
  }

  fields.push(...commonFields)

  return fields
}

// field helpers

export function getFileType (form: ExportForm): ExportFileType {
  const type = getExportFormValue(form, typeField)

  switch (type) {
    case 'wav':
      return WAV
    case 'aiff':
      return AIFF
  }

  throw new TypeError()
}

export function getSampleRate (form: ExportForm): number {
  const value = getExportFormValue(form, sampleRateField)
  return Number.parseInt(value, 10)
}

export function getLeadingSilence (form: ExportForm): Numeric<'s'> {
  const value = getExportFormValue(form, leadingSilenceField)
  return Number.parseFloat(value) as Numeric<'s'>
}

export function getEncodingOptions<TEncodingOptions> (form: ExportForm, type: ExportFileType<TEncodingOptions>): TEncodingOptions {
  switch (type) {
    case WAV:
      return { format: getExportFormValue(form, wavFormatField) } as TEncodingOptions
    case AIFF:
      return { format: getExportFormValue(form, aiffFormatField) } as TEncodingOptions
  }

  throw new TypeError()
}

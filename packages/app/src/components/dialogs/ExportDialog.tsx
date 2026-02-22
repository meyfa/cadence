import { makeNumeric, type Program } from '@core/program.js'
import { beatsToSeconds, calculateTotalLength } from '@core/time.js'
import { Field, Label } from '@headlessui/react'
import type { AudioBufferLike, AudioDescription } from '@webaudio/encoding/common.js'
import { encodeWAV, estimateWAVSize, WAVFormat, type WAVEncodingOptions } from '@webaudio/encoding/wav.js'
import { encodeAIFF, estimateAIFFSize, AIFFFormat, type AIFFEncodingOptions } from '@webaudio/encoding/aiff.js'
import { createAudioRenderer } from '@webaudio/renderer.js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCompilationState } from '../../state/CompilationContext.js'
import { saveFile } from '../../utilities/files.js'
import { formatBytes, formatDuration } from '../../utilities/strings.js'
import { Button } from '../Button.js'
import { Dropdown, type Option } from '../dropdown/Dropdown.js'
import { ProgressBar } from '../progress-bar/ProgressBar.js'
import { BaseDialog } from './BaseDialog.js'

const ASSET_LOAD_TIMEOUT = makeNumeric('s', 30)
const RENDER_CHANNELS = 2 // stereo

type FileType = 'wav' | 'aiff'
type SampleRate = '44100' | '48000' | '96000'

interface ExportFileType<TEncodingOptions = never> {
  readonly extension: string
  readonly mimeType: string
  readonly estimateSize: (audio: AudioDescription, options: TEncodingOptions) => number
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

const FILE_TYPE_OPTIONS: readonly Option[] = [
  { label: 'WAV', value: 'wav' },
  { label: 'AIFF', value: 'aiff' }
]

const WAV_FORMAT_OPTIONS: readonly Option[] = [
  { label: 'Float 32-bit', value: 'float32' },
  { label: 'PCM 16-bit', value: 'pcm16' },
  { label: 'PCM 24-bit', value: 'pcm24' },
  { label: 'PCM 32-bit', value: 'pcm32' }
]

const AIFF_FORMAT_OPTIONS: readonly Option[] = [
  { label: 'Float 32-bit', value: 'float32' },
  { label: 'PCM 16-bit', value: 'pcm16' },
  { label: 'PCM 24-bit', value: 'pcm24' },
  { label: 'PCM 32-bit', value: 'pcm32' }
]

const SAMPLE_RATE_OPTIONS: readonly Option[] = [
  { label: '44.1 kHz', value: '44100' },
  { label: '48 kHz', value: '48000' },
  { label: '96 kHz', value: '96000' }
]

function getDefaultFileName (type: ExportFileType): string {
  return `track.${type.extension}`
}

async function renderAndSave<TEncodingOptions> (
  program: Program,
  sampleRate: number,
  onProgress: (progress: number) => void,
  type: ExportFileType<TEncodingOptions>,
  options: TEncodingOptions
): Promise<readonly Error[]> {
  const renderer = createAudioRenderer({
    channels: RENDER_CHANNELS,
    sampleRate,
    assetLoadTimeout: ASSET_LOAD_TIMEOUT,
    cacheLimits: {
      arrayBuffer: 0,
      audioBuffer: 0
    },
    onProgress
  })

  const { audioBuffer, errors } = await renderer.render(program)
  if (audioBuffer == null || errors.length > 0) {
    return errors
  }

  const encoded = type.encode(audioBuffer, options)

  const content = new Blob([encoded], { type: type.mimeType })
  const filename = getDefaultFileName(type)

  saveFile({ content, filename })

  return errors
}

export const ExportDialog: FunctionComponent<{
  open: boolean
  onClose: () => void
}> = ({ open, onClose }) => {
  const { program } = useCompilationState()

  // Track the current async operation to avoid setting state after the
  // component has been unmounted or a new export was started.
  const tokenRef = useRef(0)
  useEffect(() => {
    return () => {
      ++tokenRef.current
    }
  }, [])

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [errors, setErrors] = useState<readonly Error[]>([])

  const [type, setType] = useState<FileType>(FILE_TYPE_OPTIONS[0].value as FileType)
  const [wavFormat, setWavFormat] = useState<WAVFormat>(WAV_FORMAT_OPTIONS[0].value as WAVFormat)
  const [aiffFormat, setAiffFormat] = useState<AIFFFormat>(AIFF_FORMAT_OPTIONS[0].value as AIFFFormat)
  const [sampleRate, setSampleRate] = useState<SampleRate>(SAMPLE_RATE_OPTIONS[0].value as SampleRate)

  const onDialogClose = useCallback(() => {
    if (!exporting) {
      onClose()
    }
  }, [onClose, exporting])

  useLayoutEffect(() => {
    if (!open) {
      ++tokenRef.current
      return
    }

    setType(FILE_TYPE_OPTIONS[0].value as FileType)
    setWavFormat(WAV_FORMAT_OPTIONS[0].value as WAVFormat)
    setAiffFormat(AIFF_FORMAT_OPTIONS[0].value as AIFFFormat)
    setSampleRate(SAMPLE_RATE_OPTIONS[0].value as SampleRate)

    setExporting(false)
    setProgress(undefined)
    setErrors([])
  }, [open])

  const onExport = useCallback(() => {
    if (program == null) {
      return
    }

    const exportType = type === 'wav' ? WAV : AIFF
    const format = type === 'wav' ? wavFormat : aiffFormat

    const token = ++tokenRef.current

    setExporting(true)
    setProgress(undefined)
    setErrors([])

    const onProgress = (progress: number) => {
      if (tokenRef.current === token) {
        setProgress(progress)
      }
    }

    void (async () => {
      try {
        const rate = Number.parseInt(sampleRate, 10)

        const renderErrors = await renderAndSave(program, rate, onProgress, exportType, { format })
        if (tokenRef.current !== token) {
          return
        }

        if (renderErrors.length > 0) {
          setErrors(renderErrors)
          return
        }

        onClose()
      } catch (err: unknown) {
        if (tokenRef.current !== token) {
          return
        }

        const error = err instanceof Error ? err : new Error('Unknown error during export')
        setErrors((prev) => [...prev, error])
      } finally {
        if (tokenRef.current === token) {
          setExporting(false)
        }
      }
    })()
  }, [program, type, wavFormat, aiffFormat, sampleRate, onClose])

  const trackDuration = useMemo(() => {
    if (program == null) {
      return undefined
    }

    const lengthInBeats = calculateTotalLength(program)
    return beatsToSeconds(lengthInBeats, program.track.tempo)
  }, [program])

  const estimatedSize = useMemo(() => {
    if (trackDuration == null) {
      return undefined
    }

    const exportType = type === 'wav' ? WAV : AIFF
    const format = type === 'wav' ? wavFormat : aiffFormat

    const description: AudioDescription = {
      length: Math.ceil(trackDuration.value * Number.parseInt(sampleRate, 10)),
      numberOfChannels: RENDER_CHANNELS
    }

    return exportType.estimateSize(description, { format })
  }, [trackDuration, type, wavFormat, aiffFormat, sampleRate])

  return (
    <BaseDialog
      open={open}
      onClose={onDialogClose}
      title='Export audio'
      actions={(
        <>
          <Button onClick={onExport} disabled={program == null || exporting}>
            Export
          </Button>
          <Button onClick={onDialogClose} disabled={exporting}>
            Cancel
          </Button>
        </>
      )}
    >
      {program == null && (
        <div className='mb-4 px-2 py-1 bg-error-surface text-error-content rounded-md'>
          Please fix compilation errors before exporting.
        </div>
      )}

      {errors.length > 0 && (
        <div className='mb-4 px-2 py-1 bg-error-surface text-error-content rounded-md'>
          Errors occurred during export:
          <ul className='list-disc list-inside'>
            {errors.map((error, index) => (
              <li key={index} className='pl-4 -indent-4 mt-2'>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ExportField label='File type'>
        <Dropdown
          options={FILE_TYPE_OPTIONS}
          value={type}
          onChange={(value) => setType(value as FileType)}
          disabled={exporting}
        />
      </ExportField>

      {type === 'wav' && (
        <ExportField label='WAV format'>
          <Dropdown
            options={WAV_FORMAT_OPTIONS}
            value={wavFormat}
            onChange={(value) => setWavFormat(value as WAVFormat)}
            disabled={exporting}
          />
        </ExportField>
      )}

      {type === 'aiff' && (
        <ExportField label='AIFF format'>
          <Dropdown
            options={AIFF_FORMAT_OPTIONS}
            value={aiffFormat}
            onChange={(value) => setAiffFormat(value as AIFFFormat)}
            disabled={exporting}
          />
        </ExportField>
      )}

      <ExportField label='Sample rate'>
        <Dropdown
          options={SAMPLE_RATE_OPTIONS}
          value={sampleRate}
          onChange={(value) => setSampleRate(value as SampleRate)}
          disabled={exporting}
        />
      </ExportField>

      <div className='flex flex-col mb-4'>
        {trackDuration != null && (
          <div>
            Duration: {formatDuration(trackDuration)}
          </div>
        )}

        {estimatedSize != null && (
          <div>
            File size: {formatBytes(estimatedSize)} (estimated)
          </div>
        )}
      </div>

      <ProgressBar disabled={!exporting} progress={progress} />
    </BaseDialog>
  )
}

const ExportField: FunctionComponent<PropsWithChildren<{
  label: string
}>> = ({ label, children }) => {
  return (
    <Field className='mb-4'>
      <Label className='mb-1 block text-sm font-medium text-content-100'>
        {label}
      </Label>
      {children}
    </Field>
  )
}

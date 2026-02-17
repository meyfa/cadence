import { makeNumeric, type Program } from '@core/program.js'
import { Field, Label } from '@headlessui/react'
import type { AudioBufferLike } from '@webaudio/encoding/common.js'
import { encodeWAV, WAVFormat, type WAVEncodingOptions } from '@webaudio/encoding/wav.js'
import { createAudioRenderer } from '@webaudio/renderer.js'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCompilationState } from '../../state/CompilationContext.js'
import { saveFile } from '../../utilities/files.js'
import { Button } from '../Button.js'
import { Dropdown, type Option } from '../dropdown/Dropdown.js'
import { ProgressBar } from '../progress-bar/ProgressBar.js'
import { BaseDialog } from './BaseDialog.js'

const ASSET_LOAD_TIMEOUT = makeNumeric('s', 30)

type FileType = 'wav'
type SampleRate = '44100' | '48000' | '96000'

interface ExportFileType<TEncodingOptions = never> {
  readonly extension: string
  readonly mimeType: string
  readonly encode: (audio: AudioBufferLike, options: TEncodingOptions) => ArrayBuffer
}

const WAV: ExportFileType<WAVEncodingOptions> = {
  extension: 'wav',
  mimeType: 'audio/wav',
  encode: encodeWAV
}

const FILE_TYPE_OPTIONS: readonly Option[] = [
  { label: 'WAV', value: 'wav' }
]

const WAV_FORMAT_OPTIONS: readonly Option[] = [
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
    channels: 2,
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
  const [format, setFormat] = useState<WAVFormat>(WAV_FORMAT_OPTIONS[0].value as WAVFormat)
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
    setFormat(WAV_FORMAT_OPTIONS[0].value as WAVFormat)
    setSampleRate(SAMPLE_RATE_OPTIONS[0].value as SampleRate)

    setExporting(false)
    setProgress(undefined)
    setErrors([])
  }, [open])

  const onExport = useCallback(() => {
    if (program == null) {
      return
    }

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

        const renderErrors = await renderAndSave(program, rate, onProgress, WAV, { format })
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
  }, [program, format, sampleRate, onClose])

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

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {type === 'wav' && (
        <ExportField label='WAV format'>
          <Dropdown
            options={WAV_FORMAT_OPTIONS}
            value={format}
            onChange={(value) => setFormat(value as WAVFormat)}
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

import { makeNumeric, type Program } from '@core/program.js'
import type { AudioBufferLike } from '@webaudio/encoding/common.js'
import { encodeWAV, WAVFormat, type WAVEncodingOptions } from '@webaudio/encoding/wav.js'
import { createAudioRenderer } from '@webaudio/renderer.js'
import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState, type FunctionComponent } from 'react'
import { useCompilationState } from '../../state/CompilationContext.js'
import { saveFile } from '../../utilities/files.js'
import { Button } from '../Button.js'
import { Radio } from '../radio/Radio.js'
import { RadioGroup } from '../radio/RadioGroup.js'
import { BaseDialog } from './BaseDialog.js'
import './ExportDialog.css'

const renderer = createAudioRenderer({
  channels: 2, // stereo
  sampleRate: 48_000,
  assetLoadTimeout: makeNumeric('s', 30),
  cacheLimits: {
    arrayBuffer: 0,
    audioBuffer: 0
  }
})

interface ExportFileType<TEncodingOptions = never> {
  readonly extension: string
  readonly mimeType: string
  readonly label: string

  readonly encode: (audio: AudioBufferLike, options: TEncodingOptions) => ArrayBuffer
}

const WAV: ExportFileType<WAVEncodingOptions> = {
  extension: 'wav',
  mimeType: 'audio/wav',
  label: 'WAV',
  encode: encodeWAV
}

function getDefaultFileName (type: ExportFileType): string {
  return `track.${type.extension}`
}

async function renderAndSave<TEncodingOptions> (
  program: Program,
  type: ExportFileType<TEncodingOptions>,
  options: TEncodingOptions
): Promise<readonly Error[]> {
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
  const [errors, setErrors] = useState<readonly Error[]>([])

  const [format, setFormat] = useState<WAVFormat>('float32')

  const onDialogClose = useCallback(() => {
    if (!exporting) {
      onClose()
    }
  }, [onClose, exporting])

  // reset when closing
  useEffect(() => {
    if (!open) {
      ++tokenRef.current
      setFormat('float32')
      setExporting(false)
      setErrors([])
    }
  }, [open])

  const onExport = useCallback(() => {
    if (program == null) {
      return
    }

    const token = ++tokenRef.current

    setExporting(true)

    void (async () => {
      try {
        const renderErrors = await renderAndSave(program, WAV, { format })
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
  }, [program, format, onClose])

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

      <div className='mb-4'>
        Format: {WAV.label}
      </div>

      <div className='mb-4'>
        <RadioGroup value={format} onChange={(value: string) => setFormat(value as WAVFormat)}>
          <Radio disabled={exporting} value='float32'>32-bit float</Radio>
          <Radio disabled={exporting} value='pcm16'>PCM 16-bit</Radio>
          <Radio disabled={exporting} value='pcm24'>PCM 24-bit</Radio>
          <Radio disabled={exporting} value='pcm32'>PCM 32-bit</Radio>
        </RadioGroup>
      </div>

      <IndeterminateProgressBar active={exporting} />
    </BaseDialog>
  )
}

const IndeterminateProgressBar: FunctionComponent<{ active: boolean }> = ({ active }) => {
  return (
    <div
      className='h-2 bg-surface-300 rounded-xs overflow-hidden relative'
    >
      <div
        className={clsx(
          'h-full bg-accent-100 rounded-xs w-1/3 absolute left-0 top-0 bottom-0',
          active ? 'indeterminate-progress-bar-animate' : 'opacity-0'
        )}
      />
    </div>
  )
}

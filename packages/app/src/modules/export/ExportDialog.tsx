import { createAudioGraph } from '@audiograph'
import { AIFFFormat, WAVFormat } from '@codecs'
import { Field, Label } from '@headlessui/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { Button } from '../../components/button/Button.js'
import { BaseDialog } from '../../components/dialog/BaseDialog.js'
import { Dropdown } from '../../components/dropdown/Dropdown.js'
import { ProgressBar } from '../../components/progress-bar/ProgressBar.js'
import { useCompilationState } from '../../state/CompilationContext.js'
import { formatBytes, formatDuration } from '../../utilities/strings.js'
import { AIFF, AIFF_FORMAT_OPTIONS, computeExportMetrics, FILE_TYPE_OPTIONS, renderAndSave, SAMPLE_RATE_OPTIONS, WAV, WAV_FORMAT_OPTIONS, type FileType, type SampleRate } from './export.js'

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

    const rate = Number.parseInt(sampleRate, 10)
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

    const onComplete = (errors: readonly Error[]) => {
      if (tokenRef.current === token) {
        setErrors(errors)
        setExporting(false)
        if (errors.length === 0) {
          onClose()
        }
      }
    }

    void (async () => {
      try {
        const graph = createAudioGraph(program)
        const errors = await renderAndSave(graph, rate, onProgress, exportType, { format })
        onComplete(errors)
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error('Unknown error during export')
        onComplete([error])
      }
    })()
  }, [program, sampleRate, type, wavFormat, aiffFormat, onClose])

  const metrics = useMemo(() => {
    const options = { sampleRate, type, wavFormat, aiffFormat }
    return program != null ? computeExportMetrics(program, options) : undefined
  }, [program, sampleRate, type, wavFormat, aiffFormat])

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

      {metrics != null && (
        <div className='flex flex-col mb-4'>
          <div>Duration: {formatDuration(metrics.duration)}</div>
          <div>File size: {formatBytes(metrics.fileSize)} (estimated)</div>
        </div>
      )}

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

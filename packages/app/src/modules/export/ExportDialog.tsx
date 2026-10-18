import { Field, Label } from '@headlessui/react'
import { createAudioGraph } from '@meyfa/cadence-audiograph'
import type { Program } from '@meyfa/cadence-core'
import { useIdentityToken } from '@meyfa/cadence-editor'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.tsx'
import { Button } from '../../components/button/Button.tsx'
import { BaseDialog } from '../../components/dialog/BaseDialog.tsx'
import { Dropdown } from '../../components/dropdown/Dropdown.tsx'
import { ProgressBar } from '../../components/progress-bar/ProgressBar.tsx'
import { formatBytes, formatDuration } from '../../utilities/format.ts'
import { MAX_EXPORT_DURATION, exportAudio } from './export.ts'
import type { ExportForm, ExportField } from './form.ts'
import { getExportFields, getExportFormValue, updateExportForm } from './form.ts'
import type { ExportMetrics } from './metrics.ts'
import { computeExportMetrics } from './metrics.ts'

function useExportProgram (): Readonly<{ loading: boolean, program: Program | undefined }> {
  const { loading, result: { program: currentProgram } } = useCompilationState()
  const program = loading ? undefined : currentProgram

  return { loading, program }
}

function useExportMetrics (program: Program | undefined, form: ExportForm): ExportMetrics | undefined {
  return useMemo(() => {
    return program != null ? computeExportMetrics(program, form) : undefined
  }, [program, form])
}

interface ExportHandler {
  readonly exporting: boolean
  readonly progress: number | undefined
  readonly exportErrors: readonly Error[]
  readonly start: () => void
  readonly reset: () => void
  readonly cancel: () => void
}

function useExportHandler (program: Program | undefined, form: ExportForm, onClose: () => void): ExportHandler {
  // Track the current async operation to avoid setting state after the
  // component has been unmounted or a new export was started.
  const token = useIdentityToken()

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [exportErrors, setExportErrors] = useState<readonly Error[]>([])

  const reset = useCallback(() => {
    setExporting(false)
    setProgress(undefined)
    setExportErrors([])
  }, [])

  const cancel = useCallback(() => {
    token.next()
  }, [token])

  const start = useCallback(() => {
    if (program == null || exporting) {
      return
    }

    const exportToken = token.next()
    setExporting(true)
    setProgress(undefined)
    setExportErrors([])

    const onProgress = (progress: number) => {
      if (token.current === exportToken) {
        setProgress(progress)
      }
    }

    const onComplete = (errors: readonly Error[]) => {
      if (token.current === exportToken) {
        setExportErrors(errors)
        setExporting(false)
        if (errors.length === 0) {
          onClose()
        }
      }
    }

    void (async () => {
      try {
        const graph = createAudioGraph(program)
        onComplete(await exportAudio(graph, form, onProgress))
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error('Unknown error during export')
        onComplete([error])
      }
    })()
  }, [token, program, exporting, form, onClose])

  return { exporting, progress, exportErrors, start, reset, cancel }
}

export const ExportDialog: FunctionComponent<{
  open: boolean
  onClose: () => void
}> = ({ open, onClose }) => {
  const { loading, program } = useExportProgram()

  const [form, setForm] = useState<ExportForm>({})

  const {
    exporting,
    progress,
    exportErrors,
    start,
    reset,
    cancel
  } = useExportHandler(program, form, onClose)

  useLayoutEffect(() => {
    if (open) {
      setForm({})
      reset()
    } else {
      cancel()
    }
  }, [open, reset, cancel])

  const metrics = useExportMetrics(program, form)

  const exceedsMaxDuration = metrics != null && metrics.duration > MAX_EXPORT_DURATION

  const canCancel = !exporting
  const canExport = program != null && !exceedsMaxDuration && !exporting

  const onCancel = useCallback(() => {
    if (canCancel) {
      onClose()
    }
  }, [canCancel, onClose])

  const onExport = useCallback(() => {
    if (canExport) {
      start()
    }
  }, [canExport, start])

  const fields = getExportFields(form)

  return (
    <BaseDialog
      open={open}
      onClose={onCancel}
      title='Export audio'
      actions={(
        <>
          <Button onClick={onExport} disabled={!canExport}>
            Export
          </Button>
          <Button onClick={onCancel} disabled={!canCancel}>
            Cancel
          </Button>
        </>
      )}
    >
      <ExportErrorMessage visible={loading}>
        Please wait while the project is being compiled…
      </ExportErrorMessage>

      <ExportErrorMessage visible={!loading && program == null}>
        Please fix compilation errors before exporting.
      </ExportErrorMessage>

      <ExportErrorMessage visible={!loading && exceedsMaxDuration}>
        The track exceeds the export limit ({formatDuration(MAX_EXPORT_DURATION)}).
      </ExportErrorMessage>

      <ExportErrorMessage visible={exportErrors.length > 0}>
        Errors occurred during export:
        <ul className='list-disc list-inside'>
          {exportErrors.map((error, index) => (
            <li key={index} className='pl-4 -indent-4 mt-2'>{error.message}</li>
          ))}
        </ul>
      </ExportErrorMessage>

      {fields.map((field) => (
        <ExportFieldView
          key={field.key}
          form={form}
          field={field}
          onChange={(value) => setForm((form) => updateExportForm(form, field, value))}
          disabled={exporting}
        />
      ))}

      {metrics != null && (
        <ExportMetricsView metrics={metrics} />
      )}

      <ProgressBar disabled={!exporting} progress={progress} />
    </BaseDialog>
  )
}

const ExportErrorMessage: FunctionComponent<PropsWithChildren<{
  visible: boolean
}>> = ({ children, visible }) => {
  if (!visible) {
    return null
  }

  return (
    <div className='mb-4 px-2 py-1 bg-error-surface text-error-content border border-error-frame rounded-md'>
      {children}
    </div>
  )
}

const ExportFieldView: FunctionComponent<{
  form: ExportForm
  field: ExportField
  onChange: (value: string) => void
  disabled?: boolean
}> = ({ form, field, onChange, disabled }) => {
  return (
    <Field className='mb-4'>
      <Label className='mb-1 block text-sm font-medium text-content-100'>
        {field.label}
      </Label>

      <Dropdown
        options={field.options}
        value={getExportFormValue(form, field)}
        onChange={onChange}
        disabled={disabled}
      />
    </Field>
  )
}

const ExportMetricsView: FunctionComponent<{
  metrics: ExportMetrics
}> = ({ metrics }) => {
  return (
    <div className='flex flex-col mb-4'>
      <div>Duration: {formatDuration(metrics.duration)}</div>
      <div>File size: {formatBytes(metrics.fileSize)} (estimated)</div>
    </div>
  )
}

import { linter } from '@codemirror/lint'
import { numeric } from '@core'
import { createCadenceEditor, type CadenceEditorHandle, type EditorLocation } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import clsx from 'clsx'
import { FunctionComponent, useCallback, useEffect, useRef } from 'react'
import { useMutableCallback } from '../../hooks/callback.js'
import { useEffectiveTheme } from '../../theme.js'

const TAB_SIZE = 2
const LINT_DELAY = numeric('s', 0.25)

export const Editor: FunctionComponent<{
  className?: string
  document: string
  onChange: (document: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
}> = ({ className, document, ...props }) => {
  const theme = useEffectiveTheme()

  const handleRef = useRef<CadenceEditorHandle>(null)
  const onChange = useMutableCallback(props.onChange)
  const onLocationChange = useMutableCallback(props.onLocationChange)

  // Initialize editor
  const initialize = useCallback((container: HTMLDivElement | null) => {
    if (container == null) {
      handleRef.current?.destroy()
      handleRef.current = null
      return
    }

    handleRef.current = createCadenceEditor(container, {
      document,
      theme,
      tabSize: TAB_SIZE,
      extensions: [
        cadenceLanguageSupport(),
        linter(cadenceLinter, { delay: LINT_DELAY.value * 1000 })
      ],
      onChange: (...args) => onChange.current(...args),
      onLocationChange: (...args) => onLocationChange.current?.(...args)
    })
  }, []) // Run only once

  // Update editor if props change
  useEffect(() => handleRef.current?.setDocument(document), [document])
  useEffect(() => handleRef.current?.setTheme(theme), [theme])

  return (
    <div ref={initialize} className={clsx('overflow-hidden relative', className)} />
  )
}

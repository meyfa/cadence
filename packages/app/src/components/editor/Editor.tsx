import { FunctionComponent, useCallback, useEffect, useRef } from 'react'
import { createCadenceEditor, type CadenceEditorHandle, EditorLocation } from '@editor/editor.js'
import { useMutableCallback } from '../../hooks/callback.js'
import clsx from 'clsx'
import { useTheme } from '../../theme.js'

const TAB_SIZE = 2
const LINT_DELAY = 250

export const Editor: FunctionComponent<{
  className?: string
  document: string
  onChange: (document: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
}> = ({ className, document, ...props }) => {
  const theme = useTheme()

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
      lintDelay: LINT_DELAY,
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

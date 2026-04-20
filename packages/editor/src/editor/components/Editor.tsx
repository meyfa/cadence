import type { Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { FunctionComponent, useCallback, useEffect, useRef } from 'react'
import { useLatestRef } from '../../hooks/latest-ref.js'
import { createCadenceEditor, type CadenceEditorHandle } from '../handle.js'
import type { EditorLocation } from '../types.js'

export const Editor: FunctionComponent<{
  document: string
  indent: string
  theme: Extension
  extensions?: readonly Extension[]
  diagnostics?: readonly Diagnostic[]
  cspNonce?: string
  className?: string
  onEditorViewChange?: (view: EditorView | undefined) => void
  onChange: (document: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
}> = ({ document, indent, theme, extensions, diagnostics, cspNonce, className, ...props }) => {
  const handleRef = useRef<CadenceEditorHandle>(null)
  const onChange = useLatestRef(props.onChange)
  const onLocationChange = useLatestRef(props.onLocationChange)
  const onEditorViewChange = useLatestRef(props.onEditorViewChange)

  // Initialize editor
  const initialize = useCallback((container: HTMLDivElement | null) => {
    if (container == null) {
      handleRef.current?.destroy()
      handleRef.current = null
      onEditorViewChange.current?.(undefined)
      return
    }

    handleRef.current = createCadenceEditor(container, {
      document,
      indent,
      theme,
      extensions,
      diagnostics,
      cspNonce,
      onChange: (...args) => onChange.current(...args),
      onLocationChange: (...args) => onLocationChange.current?.(...args)
    })

    onEditorViewChange.current?.(handleRef.current.view)
  }, []) // Run only once

  // Update editor if props change
  useEffect(() => handleRef.current?.setDocument(document), [document])
  useEffect(() => handleRef.current?.setIndent(indent), [indent])
  useEffect(() => handleRef.current?.setTheme(theme), [theme])
  useEffect(() => handleRef.current?.setDiagnostics(diagnostics), [diagnostics])

  return (
    <div ref={initialize} className={className} />
  )
}

import type { Extension } from '@codemirror/state'
import { FunctionComponent, useCallback, useEffect, useRef } from 'react'
import { useMutableCallback } from '../hooks/mutable-callback.js'
import { createCadenceEditor, type CadenceEditorHandle } from './handle.js'
import type { EditorLocation, EditorTheme } from './types.js'

export const Editor: FunctionComponent<{
  document: string
  indent: string
  theme: EditorTheme
  extensions?: readonly Extension[]
  className?: string
  onChange: (document: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
}> = ({ document, indent, theme, extensions, className, ...props }) => {
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
      indent,
      extensions,
      onChange: (...args) => onChange.current(...args),
      onLocationChange: (...args) => onLocationChange.current?.(...args)
    })
  }, []) // Run only once

  // Update editor if props change
  useEffect(() => handleRef.current?.setDocument(document), [document])
  useEffect(() => handleRef.current?.setIndent(indent), [indent])
  useEffect(() => handleRef.current?.setTheme(theme), [theme])

  return (
    <div ref={initialize} className={className} />
  )
}

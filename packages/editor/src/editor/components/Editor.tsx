import type { Extension } from '@codemirror/state'
import { FunctionComponent, useCallback, useEffect, useRef, type RefObject } from 'react'
import { useMutableCallback } from '../../hooks/mutable-callback.js'
import { createCadenceEditor, type CadenceEditorHandle } from '../handle.js'
import type { EditorLocation, EditorViewDispatch } from '../types.js'

export const Editor: FunctionComponent<{
  document: string
  indent: string
  extensions?: readonly Extension[]
  cspNonce?: string
  className?: string
  onChange: (document: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
  viewDispatchRef?: RefObject<EditorViewDispatch | undefined>
}> = ({ document, indent, extensions, cspNonce, className, ...props }) => {
  const handleRef = useRef<CadenceEditorHandle>(null)
  const dispatchRef = useRef<EditorViewDispatch | undefined>(undefined)
  const onChange = useMutableCallback(props.onChange)
  const onLocationChange = useMutableCallback(props.onLocationChange)

  // Initialize editor
  const initialize = useCallback((container: HTMLDivElement | null) => {
    if (container == null) {
      handleRef.current?.destroy()
      handleRef.current = null
      dispatchRef.current = undefined
      return
    }

    handleRef.current = createCadenceEditor(container, {
      document,
      indent,
      extensions,
      cspNonce,
      onChange: (...args) => onChange.current(...args),
      onLocationChange: (...args) => onLocationChange.current?.(...args)
    })

    dispatchRef.current = handleRef.current.view.dispatch.bind(handleRef.current.view)
  }, []) // Run only once

  // Update editor if props change
  useEffect(() => handleRef.current?.setDocument(document), [document])
  useEffect(() => handleRef.current?.setIndent(indent), [indent])

  if (props.viewDispatchRef != null) {
    props.viewDispatchRef.current = dispatchRef.current
  }

  return (
    <div ref={initialize} className={className} />
  )
}

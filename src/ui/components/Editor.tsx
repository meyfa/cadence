import './Editor.css'
import { EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { FunctionComponent, useEffect, useRef } from 'react'
import { oneDark } from '@codemirror/theme-one-dark'
import { cadenceLanguageSupport } from '../../editor/language-support.js'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'

export const Editor: FunctionComponent<{
  value: string
  onChange: (value: string) => void
  onLocationChange?: (location: { line: number, column: number } | undefined) => void
}> = ({ value, onChange, onLocationChange }) => {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onLocationChangeRef = useRef(onLocationChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  // Initialize editor
  useEffect(() => {
    if (editorRef.current == null) {
      return
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
      }

      if (onLocationChangeRef.current) {
        const selections = update.state.selection.ranges
        if (selections.length === 1) {
          const pos = selections[0].head
          const line = update.state.doc.lineAt(pos)
          const column = pos - line.from + 1
          onLocationChangeRef.current({ line: line.number, column })
        } else {
          onLocationChangeRef.current(undefined)
        }
      }
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        EditorState.tabSize.of(2),
        keymap.of([
          indentWithTab,
          // Disable browser save dialog, improving UX for users accustomed to regularly pressing Ctrl+S
          { key: 'Ctrl-s', run: () => true }
        ]),
        oneDark,
        cadenceLanguageSupport(),
        updateListener
      ]
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // Run only once

  // Update editor content if value prop changes
  useEffect(() => {
    const view = viewRef.current
    if (view != null && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value
        }
      })
    }
  }, [value])

  return (
    <div
      ref={editorRef}
      className='flex-1 min-h-0 min-w-0 overflow-hidden relative Editor'
    />
  )
}

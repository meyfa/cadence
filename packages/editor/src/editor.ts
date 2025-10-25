import { indentWithTab } from '@codemirror/commands'
import { linter } from '@codemirror/lint'
import { Compartment, EditorState, type SelectionRange, type Text } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { cadenceLanguageSupport } from './language-support.js'
import { cadenceLinter } from './linter.js'
import { cadenceDarkTheme, cadenceLightTheme } from './theme.js'

export type EditorTheme = 'dark' | 'light'

export interface EditorLocation {
  readonly line: number
  readonly column: number
}

export interface CadenceEditorOptions {
  readonly document: string

  readonly theme: EditorTheme

  readonly tabSize: number
  readonly lintDelay: number

  readonly onChange: (value: string) => void
  readonly onLocationChange?: (location: EditorLocation | undefined) => void
}

export interface CadenceEditorHandle {
  readonly view: EditorView
  readonly setDocument: (value: string) => void
  readonly setTheme: (theme: EditorTheme) => void
  readonly destroy: () => void
}

export function createCadenceEditor (parent: HTMLElement, options: CadenceEditorOptions): CadenceEditorHandle {
  const { tabSize, lintDelay } = options

  const updateListener = EditorView.updateListener.of(({ state, docChanged, selectionSet }) => {
    if (docChanged) {
      options.onChange(state.doc.toString())
    }

    if ((selectionSet || docChanged) && options.onLocationChange != null) {
      options.onLocationChange(getEditorLocation(state.selection.ranges, state.doc))
    }
  })

  const themeConfig = new Compartment()

  const state = EditorState.create({
    doc: options.document,
    extensions: [
      basicSetup,

      EditorState.tabSize.of(tabSize),

      keymap.of([
        indentWithTab,
        // Disable browser save dialog, improving UX for users accustomed to regularly pressing Ctrl+S
        { key: 'Ctrl-s', run: () => true }
      ]),

      themeConfig.of(
        options.theme === 'light' ? cadenceLightTheme : cadenceDarkTheme
      ),

      EditorView.theme({
        '&.cm-editor': {
          height: '100%'
        }
      }),

      cadenceLanguageSupport(),
      linter(cadenceLinter, { delay: lintDelay }),

      updateListener
    ]
  })

  const view = new EditorView({ state, parent })

  // Emit initial cursor location
  if (options.onLocationChange != null) {
    options.onLocationChange(getEditorLocation(view.state.selection.ranges, view.state.doc))
  }

  return {
    view,

    setDocument: (value: string) => {
      const current = view.state.doc.toString()
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value }
        })
      }
    },

    setTheme: (theme: EditorTheme) => {
      view.dispatch({
        effects: themeConfig.reconfigure(
          theme === 'light' ? cadenceLightTheme : cadenceDarkTheme
        )
      })
    },

    destroy: () => view.destroy()
  }
}

function getEditorLocation (selections: readonly SelectionRange[], doc: Text): EditorLocation | undefined {
  if (selections.length !== 1) {
    return undefined
  }

  const pos = selections[0].head
  const line = doc.lineAt(pos)
  const column = pos - line.from + 1

  return { line: line.number, column }
}

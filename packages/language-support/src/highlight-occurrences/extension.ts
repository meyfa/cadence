import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { applySemanticOperation } from '../utilities/operations.js'
import { findHighlightedOccurrences } from './operation.js'

const OCCURRENCE_CLASS = 'cm-cadence-highlight-occurrence'

const occurrenceMark = Decoration.mark({ class: OCCURRENCE_CLASS })

const theme = EditorView.baseTheme({
  [`.${OCCURRENCE_CLASS}`]: {
    backgroundColor: 'rgb(127 127 127 / 20%)',
    borderRadius: '2px'
  }
})

class HighlightOccurrencesPlugin {
  decorations: DecorationSet

  constructor (view: EditorView) {
    this.decorations = getOccurrenceDecorations(view.state)
  }

  update (update: ViewUpdate): void {
    const changed = update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state)

    if (changed || update.selectionSet) {
      this.decorations = getOccurrenceDecorations(update.state)
    }
  }
}

const plugin = ViewPlugin.fromClass(HighlightOccurrencesPlugin, {
  decorations: (plugin) => plugin.decorations
})

function getOccurrenceDecorations (state: EditorState): DecorationSet {
  const { selection } = state

  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return Decoration.none
  }

  const tree = syntaxTree(state)
  const position = selection.main.head
  const ranges = applySemanticOperation(findHighlightedOccurrences, tree, state.doc, position)

  if (ranges.length === 0) {
    return Decoration.none
  }

  const isPreSorted = true

  return Decoration.set(
    ranges.map(({ offset, length }) => occurrenceMark.range(offset, offset + length)),
    !isPreSorted
  )
}

export function highlightOccurrencesExtension (): Extension {
  return [theme, plugin]
}

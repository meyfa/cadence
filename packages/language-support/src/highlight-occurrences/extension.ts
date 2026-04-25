import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import type { Tree } from '@lezer/common'
import type { Model } from '../analysis/model.js'
import { analyzeTree } from '../analysis/model.js'
import type { RangesByBinding } from '../analysis/query.js'
import { buildReferenceRangesByBinding, findDefinitionBindingAt } from '../analysis/query.js'

const OCCURRENCE_CLASS = 'cm-cadence-highlight-occurrence'

const occurrenceMark = Decoration.mark({ class: OCCURRENCE_CLASS })

const theme = EditorView.baseTheme({
  [`.${OCCURRENCE_CLASS}`]: {
    backgroundColor: 'rgb(127 127 127 / 20%)',
    borderRadius: '2px'
  }
})

class HighlightOccurrencesPlugin {
  private analysisState: AnalysisState

  decorations: DecorationSet

  constructor (view: EditorView) {
    this.analysisState = buildAnalysisState(view.state)
    this.decorations = getOccurrenceDecorations(view.state, this.analysisState)
  }

  update (update: ViewUpdate): void {
    const changed = update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state)

    if (changed) {
      this.analysisState = buildAnalysisState(update.state)
    }

    if (changed || update.selectionSet) {
      this.decorations = getOccurrenceDecorations(update.state, this.analysisState)
    }
  }
}

const plugin = ViewPlugin.fromClass(HighlightOccurrencesPlugin, {
  decorations: (plugin) => plugin.decorations
})

interface AnalysisState {
  readonly tree: Tree
  readonly model: Model
  readonly rangesByBinding: RangesByBinding
}

function buildAnalysisState (state: EditorState): AnalysisState {
  const tree = syntaxTree(state)
  const model = analyzeTree(tree, state.doc)
  const rangesByBinding = buildReferenceRangesByBinding(model, tree, state.doc)
  return { tree, model, rangesByBinding }
}

function getOccurrenceDecorations (state: EditorState, analysisState: AnalysisState): DecorationSet {
  const { doc, selection } = state
  const { tree, model, rangesByBinding } = analysisState

  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return Decoration.none
  }

  const binding = findDefinitionBindingAt(model, tree, doc, selection.main.head)
  const ranges = binding != null ? rangesByBinding.get(binding.id) : undefined

  if (ranges == null || ranges.length === 0) {
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

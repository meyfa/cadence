import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { analyzeTree } from '../model/analysis.js'
import type { Model } from '../model/model.js'
import type { RangesByBinding } from '../model/query.js'
import { buildReferenceRangesByBinding, findDefinitionBindingAt } from '../model/query.js'

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
  readonly model: Model
  readonly rangesByBinding: RangesByBinding
}

function buildAnalysisState (state: EditorState): AnalysisState {
  const model = analyzeTree(syntaxTree(state), state.doc)
  const rangesByBinding = buildReferenceRangesByBinding(model)
  return { model, rangesByBinding }
}

function getOccurrenceDecorations (state: EditorState, analysisState: AnalysisState): DecorationSet {
  const { selection } = state
  const { model, rangesByBinding } = analysisState

  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return Decoration.none
  }

  const binding = findDefinitionBindingAt(model, selection.main.head)
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

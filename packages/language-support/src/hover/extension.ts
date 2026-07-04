import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView, hoverTooltip } from '@codemirror/view'
import { applySemanticOperation } from '../utilities/operations.js'
import { getHoverInfo } from './operation.js'

const theme = EditorView.baseTheme({
  '.cm-cadence-hover': {
    padding: '8px 10px',
    maxWidth: '32rem',
    boxShadow: '0 2px 4px rgb(0 0 0 / 20%)',
    borderRadius: '4px'
  },
  '.cm-cadence-hoverTitle': {
    fontFamily: 'monospace',
    fontSize: '0.9em',
    fontWeight: '600'
  },
  '.cm-cadence-hoverSummary': {
    marginTop: '0.35rem',
    whiteSpace: 'pre-wrap'
  },
  '.cm-cadence-hoverAnnotation': {
    display: 'inline-block',
    marginTop: '0.35rem',
    marginRight: '0.25rem',
    fontSize: '0.8em',
    padding: '2px 4px',
    borderRadius: '2px',
    backgroundColor: 'color-mix(in srgb, currentColor, transparent 80%)',
    fontFamily: 'monospace'
  }
})

const tooltip = hoverTooltip((view, position) => {
  const info = applySemanticOperation(getHoverInfo, syntaxTree(view.state), view.state.doc, position)
  if (info == null) {
    return null
  }

  const pos = info.range.offset
  const end = info.range.offset + info.range.length

  const create = () => {
    const dom = document.createElement('div')
    dom.className = 'cm-cadence-hover'

    const title = dom.appendChild(document.createElement('div'))
    title.className = 'cm-cadence-hoverTitle'
    title.textContent = info.title

    if (info.summary != null && info.summary.length > 0) {
      const summary = dom.appendChild(document.createElement('div'))
      summary.className = 'cm-cadence-hoverSummary'
      summary.textContent = info.summary
    }

    for (const annotation of info.annotations ?? []) {
      const annotationElement = dom.appendChild(document.createElement('div'))
      annotationElement.className = 'cm-cadence-hoverAnnotation'
      annotationElement.textContent = annotation
    }

    return { dom }
  }

  return { pos, end, create }
})

export function hoverInfoExtension (): Extension {
  return [theme, tooltip]
}

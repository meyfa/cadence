import { diagnosticCount } from '@codemirror/lint'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCadenceEditor } from '../../src/editor/handle.js'

describe('editor/handle.ts', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('updates diagnostics after initialization', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const handle = createCadenceEditor(container, {
      document: 'track main {}',
      indent: '  ',
      theme: [],
      onChange: () => {},
      onLocationChange: () => {}
    })

    try {
      expect(diagnosticCount(handle.view.state)).toBe(0)

      handle.setDiagnostics([
        {
          from: 0,
          to: 5,
          severity: 'error',
          message: 'Broken track declaration'
        }
      ])

      expect(diagnosticCount(handle.view.state)).toBe(1)
    } finally {
      handle.destroy()
    }
  })

  it('emits editor view updates when the document changes', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const onEditorViewUpdate = vi.fn()
    const handle = createCadenceEditor(container, {
      document: 'track main {}',
      indent: '  ',
      theme: [],
      onChange: () => {},
      onLocationChange: () => {},
      onEditorViewUpdate
    })

    try {
      handle.setDocument('track alt {}')

      expect(onEditorViewUpdate).toHaveBeenCalled()
    } finally {
      handle.destroy()
    }
  })
})

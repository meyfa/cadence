import type { DockLayout, LayoutNodeId, PanelId, TabId } from '@editor'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getFocusedEditorCaret, getFocusedEditorFilePath } from '../../../src/modules/editor/caret.js'

const testEditorPanelId = 'editor.editor' as PanelId
const testMixerPanelId = 'mixer.mixer' as PanelId

const firstEditorTabId = 'editor-a' as TabId
const secondEditorTabId = 'editor-b' as TabId
const mixerTabId = 'mixer' as TabId

function createLayout (focusedTabId?: TabId): DockLayout {
  return {
    main: {
      id: 'main-pane' as LayoutNodeId,
      type: 'pane',
      tabs: [
        {
          id: firstEditorTabId,
          component: {
            type: testEditorPanelId,
            props: { filePath: 'track.cadence' }
          }
        },
        {
          id: secondEditorTabId,
          component: {
            type: testEditorPanelId,
            props: { filePath: 'track.cadence' }
          }
        },
        {
          id: mixerTabId,
          component: {
            type: testMixerPanelId
          }
        }
      ],
      activeTabId: firstEditorTabId
    },
    focusedTabId
  }
}

describe('modules/editor/caret.ts', () => {
  it('returns the caret for the focused editor tab instance', () => {
    const carets = {
      [firstEditorTabId]: { line: 1, column: 2 },
      [secondEditorTabId]: { line: 10, column: 20 }
    }

    assert.deepStrictEqual(
      getFocusedEditorCaret(createLayout(firstEditorTabId), testEditorPanelId, carets),
      { line: 1, column: 2 }
    )

    assert.deepStrictEqual(
      getFocusedEditorCaret(createLayout(secondEditorTabId), testEditorPanelId, carets),
      { line: 10, column: 20 }
    )
  })

  it('returns no caret when the focused tab is not an editor', () => {
    const carets = {
      [firstEditorTabId]: { line: 1, column: 2 }
    }

    assert.strictEqual(getFocusedEditorCaret(createLayout(mixerTabId), testEditorPanelId, carets), undefined)
  })

  it('returns no caret when no tab is focused', () => {
    const carets = {
      [firstEditorTabId]: { line: 1, column: 2 }
    }

    assert.strictEqual(getFocusedEditorCaret(createLayout(), testEditorPanelId, carets), undefined)
  })

  it('fails safely when focused editor props are invalid', () => {
    const layout: DockLayout = {
      main: {
        id: 'main-pane' as LayoutNodeId,
        type: 'pane',
        tabs: [
          {
            id: firstEditorTabId,
            component: {
              type: testEditorPanelId,
              props: { wrong: true }
            }
          }
        ],
        activeTabId: firstEditorTabId
      },
      focusedTabId: firstEditorTabId
    }

    assert.strictEqual(getFocusedEditorFilePath(layout, testEditorPanelId), undefined)
  })
})

import assert from 'node:assert'
import { describe, it } from 'node:test'
import { findPaneById, findPaneByTabId, findTabByComponentType } from '../../../src/layout/algorithms/find.js'
import { activateTabInPane, activateTabOfType, createTab, moveTabBetweenPanes, moveTabIntoPane, moveTabToPaneEnd, moveTabToSplit, removeTabFromPane, transformNode, updateFocusedTab } from '../../../src/layout/algorithms/mutate.js'
import type { DockLayout, LayoutNodeId, PaneNode, SplitNode } from '../../../src/layout/types.js'
import { pane1Id, pane2Id, pane3Id, tab1Id, tab2Id, tab3Id, tab4Id, testLayout } from './fixtures.js'

describe('layout/algorithms/mutate.ts', () => {
  function getPane (layout: DockLayout, paneId: LayoutNodeId): PaneNode {
    const pane = findPaneById(layout, paneId)
    assert.ok(pane != null)
    return pane
  }

  describe('transformNode', () => {
    it('updates a matching node', () => {
      const updated = transformNode(testLayout, pane1Id, (node) => ({
        ...node,
        activeTabId: tab2Id
      }))

      assert.strictEqual(getPane(updated, pane1Id).activeTabId, tab2Id)
    })
  })

  describe('createTab', () => {
    it('creates a pane when the layout is empty', () => {
      const updated = createTab({}, { type: 'ComponentX' })

      assert.ok(updated.main != null)
      assert.strictEqual(updated.main.type, 'pane')
      assert.strictEqual(updated.main.tabs.length, 1)
      assert.strictEqual(updated.main.tabs[0].component.type, 'ComponentX')
      assert.strictEqual(updated.focusedTabId, updated.main.tabs[0].id)
    })

    it('adds a tab to the largest pane and focuses it', () => {
      const updated = createTab(testLayout, { type: 'ComponentX' })
      const pane = getPane(updated, pane2Id)
      const newTab = pane.tabs.at(-1)

      assert.ok(newTab != null)
      assert.strictEqual(newTab.component.type, 'ComponentX')
      assert.strictEqual(pane.activeTabId, newTab.id)
      assert.strictEqual(updated.focusedTabId, newTab.id)
    })
  })

  describe('removeTabFromPane', () => {
    it('removes a tab from its pane', () => {
      const updated = removeTabFromPane(testLayout, tab2Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])
    })
  })

  describe('activateTabInPane', () => {
    it('activates and focuses the requested tab', () => {
      const updated = activateTabInPane(testLayout, tab2Id)

      assert.strictEqual(getPane(updated, pane1Id).activeTabId, tab2Id)
      assert.strictEqual(updated.focusedTabId, tab2Id)
    })
  })

  describe('moveTabIntoPane', () => {
    it('moves a tab into another pane after the active tab', () => {
      const updated = moveTabIntoPane(testLayout, tab2Id, pane2Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])
      assert.deepStrictEqual(getPane(updated, pane2Id).tabs.map((tab) => tab.id), [tab3Id, tab2Id])
      assert.strictEqual(getPane(updated, pane2Id).activeTabId, tab2Id)
      assert.strictEqual(updated.focusedTabId, tab2Id)
    })
  })

  describe('moveTabBetweenPanes', () => {
    it('reorders tabs within the same pane', () => {
      const updated = moveTabBetweenPanes(testLayout, tab2Id, tab1Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab2Id, tab1Id])
      assert.strictEqual(getPane(updated, pane1Id).activeTabId, tab2Id)
    })

    it('moves a tab in front of a tab in another pane', () => {
      const updated = moveTabBetweenPanes(testLayout, tab2Id, tab4Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])
      assert.deepStrictEqual(getPane(updated, pane3Id).tabs.map((tab) => tab.id), [tab2Id, tab4Id])
      assert.strictEqual(getPane(updated, pane3Id).activeTabId, tab2Id)
    })

    it('can insert a tab after another tab in the same pane', () => {
      const updated = moveTabBetweenPanes(testLayout, tab1Id, tab2Id, 'after')

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab2Id, tab1Id])
      assert.strictEqual(getPane(updated, pane1Id).activeTabId, tab1Id)
    })

    it('can insert a tab after another tab in a different pane', () => {
      const updated = moveTabBetweenPanes(testLayout, tab2Id, tab3Id, 'after')

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])
      assert.deepStrictEqual(getPane(updated, pane2Id).tabs.map((tab) => tab.id), [tab3Id, tab2Id])
      assert.strictEqual(getPane(updated, pane2Id).activeTabId, tab2Id)
    })
  })

  describe('moveTabToPaneEnd', () => {
    it('moves a tab to the end of another pane', () => {
      const updated = moveTabToPaneEnd(testLayout, tab2Id, pane2Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])
      assert.deepStrictEqual(getPane(updated, pane2Id).tabs.map((tab) => tab.id), [tab3Id, tab2Id])
      assert.strictEqual(getPane(updated, pane2Id).activeTabId, tab2Id)
    })

    it('moves a tab to the end of its own pane', () => {
      const updated = moveTabToPaneEnd(testLayout, tab1Id, pane1Id)

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab2Id, tab1Id])
      assert.strictEqual(getPane(updated, pane1Id).activeTabId, tab1Id)
    })
  })

  describe('activateTabOfType', () => {
    it('focuses an existing tab when the component type already exists', () => {
      const updated = activateTabOfType(testLayout, 'ComponentC', () => ({ type: 'ComponentC' }))

      assert.strictEqual(getPane(updated, pane2Id).activeTabId, tab3Id)
      assert.strictEqual(updated.focusedTabId, tab3Id)
    })

    it('creates a new tab when the component type does not exist', () => {
      const updated = activateTabOfType(testLayout, 'ComponentX', () => ({
        type: 'ComponentX',
        props: { someProp: 'someValue' }
      }))
      const tab = findTabByComponentType(updated, 'ComponentX')

      assert.ok(tab != null)
      assert.strictEqual(updated.focusedTabId, tab.id)
      assert.deepStrictEqual(tab.component, { type: 'ComponentX', props: { someProp: 'someValue' } })
    })
  })

  describe('updateFocusedTab', () => {
    it('updates the focused tab without changing pane contents', () => {
      const updated = updateFocusedTab(testLayout, tab4Id)

      assert.strictEqual(updated.focusedTabId, tab4Id)
      assert.deepStrictEqual(getPane(updated, pane3Id).tabs.map((tab) => tab.id), [tab4Id])
    })
  })

  describe('moveTabToSplit', () => {
    it('moves a tab into a new sibling split pane', () => {
      const updated = moveTabToSplit(testLayout, tab2Id, pane3Id, 'east')

      assert.deepStrictEqual(getPane(updated, pane1Id).tabs.map((tab) => tab.id), [tab1Id])

      const movedPane = findPaneByTabId(updated, tab2Id)
      assert.ok(movedPane != null)
      assert.notStrictEqual(movedPane.id, pane1Id)
      assert.strictEqual(movedPane.activeTabId, tab2Id)
      assert.strictEqual(updated.focusedTabId, tab2Id)

      const root = updated.main as SplitNode
      assert.strictEqual(root.type, 'split')
      assert.strictEqual(root.children[1].type, 'split')

      const rightBranch = root.children[1]
      assert.strictEqual(rightBranch.type, 'split')

      const nestedSplit = rightBranch.children[1]
      assert.strictEqual(nestedSplit.type, 'split')
      assert.strictEqual(nestedSplit.orientation, 'horizontal')
    })
  })
})

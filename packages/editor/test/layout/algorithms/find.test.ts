import assert from 'node:assert'
import { describe, it } from 'node:test'
import { findNode, findNodeById, findPane, findPaneById, findPaneByTabId, findTab, findTabByComponentType } from '../../../src/layout/algorithms/find.js'
import { pane1Id, pane2Id, pane3Id, tab2Id, tab3Id, tab4Id, testLayout } from './fixtures.js'

describe('layout/algorithms/find.ts', () => {
  describe('findNode', () => {
    it('should find a node by predicate', () => {
      const node = findNode(testLayout, (node) => node.id === pane2Id)
      assert.strictEqual(node?.id, pane2Id)
    })
  })

  describe('findNodeById', () => {
    it('should find a node by id', () => {
      const node = findNodeById(testLayout, pane3Id)
      assert.strictEqual(node?.id, pane3Id)
    })
  })

  describe('findPane', () => {
    it('should find a pane by predicate', () => {
      const pane = findPane(testLayout, (pane) => pane.id === pane1Id)
      assert.strictEqual(pane?.id, pane1Id)
    })
  })

  describe('findPaneById', () => {
    it('should find a pane by id', () => {
      const pane = findPaneById(testLayout, pane2Id)
      assert.strictEqual(pane?.id, pane2Id)
    })
  })

  describe('findPaneByTabId', () => {
    it('should find a pane by tab id', () => {
      const pane = findPaneByTabId(testLayout, tab4Id)
      assert.strictEqual(pane?.id, pane3Id)
    })
  })

  describe('findTab', () => {
    it('should find a tab by predicate', () => {
      const tab = findTab(testLayout, (tab) => tab.id === tab2Id)
      assert.strictEqual(tab?.id, tab2Id)
    })
  })

  describe('findTabByComponentType', () => {
    it('should find a tab by component type', () => {
      const tab = findTabByComponentType(testLayout, 'ComponentC')
      assert.strictEqual(tab?.id, tab3Id)
    })
  })
})
